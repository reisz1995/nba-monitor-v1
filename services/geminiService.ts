import { Type } from "@google/genai";
import { Team, Insight, MatchupAnalysis, Source, PlayerStat, ESPNData, UnavailablePlayer, MarketData } from "../types";
import { supabase } from "../lib/supabase";
import { calculateDeterministicPace } from "../lib/nbaUtils";
import { toast } from "sonner";
import { withRetry } from "../lib/resilience";

// ==========================================
// 1. FORMATADORES DE MATRIZ (PARSERS)
// ==========================================
export const formatStandingsForAI = (data: Partial<ESPNData>[]): string => {
  if (!data || data.length === 0) return "Sem dados de classificação.";
  let output = "TIME|V|D|%|PTS+|PTS-|SEQ\n";
  output += data.map(t => {
    const name = t.time || t.name || 'Time';
    const v = t.vitorias ?? t.wins ?? 0;
    const d = t.derrotas ?? t.losses ?? 0;
    const pct = (t.aproveitamento || t.win_pct) ? Number(t.aproveitamento || t.win_pct).toFixed(3) : '.000';
    const ptsA = t.media_pontos_ataque || t.pts_ataque || '-';
    const ptsD = t.media_pontos_defesa || t.pts_defesa || '-';
    const seq = t.ultimos_5 || t.streak || '-';
    return `${name}|${v}|${d}|${pct}|${ptsA}|${ptsD}|${seq}`;
  }).join('\n');
  return output;
};

export const formatPlayerStatsForAI = (players: PlayerStat[]): string => {
  if (!players || players.length === 0) return "Sem dados de jogadores.";
  let output = "JOGADOR|TIME|POS|PTS|REB|AST\n";
  output += players.map(p => {
    const name = p.nome || p.player_name || 'Jog';
    const time = p.time || p.team_name || '-';
    const pos = p.posicao || p.position || '-';
    const pts = p.pontos ?? p.pts ?? 0;
    const reb = p.rebotes ?? p.reb ?? 0;
    const ast = p.assistencias ?? p.ast ?? 0;
    return `${name}|${time}|${pos}|${pts}|${reb}|${ast}`;
  }).join('\n');
  return output;
};

export const formatInjuriesForAI = (injuries: UnavailablePlayer[]): string => {
  if (!injuries || injuries.length === 0) return "Nenhum desfalque registrado.";
  let output = "JOGADOR|TIME|MOTIVO|STATUS|RETORNO\n";
  output += injuries.map(i => {
    const name = i.player_name || i.nome || 'Jog';
    const time = i.team_name || i.time || '-';
    const desc = i.injury_description || i.motivo || '-';
    const status = i.injury_status || i.gravidade || '-';
    const ret = i.retorno_previsto || i.retorno || 'TBD';
    return `${name}|${time}|${desc}|${status}|${ret}`;
  }).join('\n');
  return output;
};

// ==========================================
// 2. PROXY CLIENT (SEM CHAVE NO BROWSER)
// ==========================================

/**
 * Calls the server-side /api/ai-analyze proxy.
 * The Gemini API key never reaches the browser bundle.
 */
const callGeminiProxy = async (mode: 'compareTeams' | 'analyzeStandings', prompt: string): Promise<string> => {
  const response = await fetch('/api/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erro desconhecido no proxy.' }));
    throw new Error(err.error || `Proxy retornou HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.text) throw new Error('COLAPSO_PAYLOAD_NULO');
  return data.text;
};

// ==========================================
// 3. MOTORES DE CÁLCULO E INFERÊNCIA
// ==========================================

export const fetchGameWithMomentum = async (gameId: string) => {
  const { data, error } = await supabase
    .from('game_predictions')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error || !data) {
    console.error("[Supabase] Falha ao extrair Matriz Temporal:", error);
    return null;
  }

  const { data: teamsData } = await supabase
    .from('teams')
    .select('name, record')
    .in('name', [data.home_team, data.away_team]);

  const homeTeamData = teamsData?.find(t => t.name === data.home_team);
  const awayTeamData = teamsData?.find(t => t.name === data.away_team);

  const parseJSONField = (field: any, fallback: any) => {
    try {
      if (!field) return fallback;
      return typeof field === 'string' ? JSON.parse(field) : field;
    } catch (e) {
      console.warn("[JSON Parsing] Estrutura corrompida identificada. Fallback injetado.", e);
      return fallback;
    }
  };

  return {
    ...data,
    home_record: parseJSONField(homeTeamData?.record, []),
    away_record: parseJSONField(awayTeamData?.record, []),
    momentum_data: parseJSONField(data.momentum_data, { home_vs_away: [] }),
  };
};

export const saveMatchupAnalysis = async (teamA: Team | number, teamB: Team | number, analysis: MatchupAnalysis) => {
  try {
    const teamAId = typeof teamA === 'number' ? teamA : teamA.id;
    const teamBId = typeof teamB === 'number' ? teamB : teamB.id;

    let cleanConfidence = Number(analysis.confidence);
    if (cleanConfidence <= 1) cleanConfidence = Math.round(cleanConfidence * 100);
    else cleanConfidence = Math.round(cleanConfidence);

    const { error } = await supabase.from('matchup_analyses').insert({
      team_a_id: teamAId,
      team_b_id: teamBId,
      winner: analysis.winner,
      confidence: cleanConfidence,
      key_factor: analysis.keyFactor,
      detailed_analysis: analysis.detailedAnalysis,
      sources: analysis.sources,
      momentum_ma: analysis.momentumData,
      result: 'pending',
      created_at: new Date().toISOString()
    });

    if (error) throw error;
  } catch (err) {
    console.error("Erro ao salvar histórico de análise no Supabase:", err);
  }
};

export const compareTeams = async (
  teamA: Team,
  teamB: Team,
  playerStats: PlayerStat[],
  injuries: UnavailablePlayer[] = [],
  marketData?: MarketData | null,
  momentumData?: any
): Promise<MatchupAnalysis> => {

  const [dbStats, dbInjuries, dbStandings, dbNotas] = await Promise.all([
    supabase.from('nba_jogadores_stats').select('*').in('time', [teamA.name, teamB.name]),
    supabase.from('nba_injured_players').select('*').in('team_name', [teamA.name, teamB.name]),
    supabase.from('classificacao_nba').select('*').in('time', [teamA.name, teamB.name]),
    supabase.from('tabela_notas').select('*').in('franquia', [teamA.name, teamB.name])
  ]);

  const notaA = Number(dbNotas.data?.find(n => n.franquia === teamA.name)?.nota_ia || teamA.ai_score || 0);
  const notaB = Number(dbNotas.data?.find(n => n.franquia === teamB.name)?.nota_ia || teamB.ai_score || 0);

  const compactStats = formatPlayerStatsForAI((dbStats.data || playerStats).slice(0, 15));
  const compactInjuries = formatInjuriesForAI(dbInjuries.data || injuries);
  const compactStandings = formatStandingsForAI(dbStandings.data || []);

  const { matchPace, totalPayload, kineticState, deltaA, deltaB } = calculateDeterministicPace(teamA, teamB, { isHomeA: true });

  const formA = typeof teamA.record === 'string' ? teamA.record : JSON.stringify(teamA.record || []);
  const formB = typeof teamB.record === 'string' ? teamB.record : JSON.stringify(teamB.record || []);
  const h2hContext = momentumData?.momentum_data?.home_vs_away && momentumData.momentum_data.home_vs_away.length > 0
    ? JSON.stringify(momentumData.momentum_data.home_vs_away)
    : "DADOS_H2H_INDISPONIVEIS";

  const projectedSpread = deltaB - deltaA;
  const marketSpread = marketData?.spread ?? null;
  let edgeBlock = "Market_Odds: Indisponível";
  if (marketSpread !== null) {
    const edge = Math.abs(projectedSpread - marketSpread);
    const classification = edge >= 3.0 ? "🔴 VALUE_BET DETECTADO" : "⚪ DENTRO DA MARGEM";
    edgeBlock = `Spread de Mercado: ${marketSpread} | Spread Projetado: ${projectedSpread.toFixed(1)} | Edge: ${edge.toFixed(1)} pts | ${classification}`;
  }

  const prompt = `ALVO DE COMPUTAÇÃO: ${teamA.name} vs ${teamB.name}.

  [VETOR 1: EFICIÊNCIA ESTRUTURAL]
  Rating AI ${teamA.name}: ${notaA.toFixed(1)}/5.0
  Rating AI ${teamB.name}: ${notaB.toFixed(1)}/5.0
  ${compactStandings}

  [VETOR 2: ALGORITMO CINÉTICO (v2.2)]
  Pace do Confronto: ${matchPace.toFixed(1)} (${kineticState})
  Pontuação Base ${teamA.name}: ${deltaA.toFixed(1)}
  Pontuação Base ${teamB.name}: ${deltaB.toFixed(1)}
  Total Projetado: ${totalPayload.toFixed(1)}

  [VETOR 3: ASSIMETRIA DE MERCADO]
  ${edgeBlock}
  Mercado (Total/ML): Total=${marketData?.total ?? 'N/D'} | ML Away=${marketData?.moneyline_away ?? 'N/D'} | ML Home=${marketData?.moneyline_home ?? 'N/D'}

  [VETOR 4: MOMENTO TERMODINÂMICO]
  Forma ${teamA.name} (Últimos 5): ${formA}
  Forma ${teamB.name} (Últimos 5): ${formB}
  Confronto Direto (H2H): ${h2hContext}

  [VETOR 5: INTEGRIDADE FÍSICA]
  ${compactInjuries}

  PROCESSE AS DIRETRIZES E RETORNE O JSON STRICT.`;

  try {
    const text = await withRetry(() => callGeminiProxy('compareTeams', prompt), { retries: 2, initialDelay: 500 });
    const analysisResult = JSON.parse(text);
    return { ...analysisResult, sources: [], momentumData };
  } catch (error) {
    console.error("[IA_ENGINE] Colapso na matriz vetorial:", error);
    return {
      winner: "N/A",
      confidence: 0,
      keyFactor: "ANOMALIA_DE_SISTEMA",
      detailedAnalysis: "Falha na sincronização termodinâmica. Operação revertida para baseline de segurança.",
      expectedScoreA: 0,
      expectedScoreB: 0,
      projectedPace: 0,
      result: 'pending'
    };
  }
};

export const analyzeStandings = async (teams: Team[]): Promise<Insight[]> => {
  const prompt = "Gere insights baseados no Momento Termodinâmico, Handicaps Positivos e Cansaço (B2B).";

  try {
    const text = await withRetry(() => callGeminiProxy('analyzeStandings', prompt), { retries: 2, initialDelay: 500 });
    const insights: Insight[] = JSON.parse(text);
    return insights;
  } catch (error) {
    console.error("[IA_ENGINE] Colapso de Insights:", error);
    return [{
      title: "SYSTEM_WARNING: IA OFFLINE",
      content: "Motor temporariamente indisponível. Analise a Matriz no HUD.",
      type: "warning"
    }];
  }
};
