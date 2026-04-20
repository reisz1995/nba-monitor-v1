import { Type } from "@google/genai";
import { Team, Insight, MatchupAnalysis, Source, PlayerStat, ESPNData, UnavailablePlayer, MarketData } from "../types";
import { supabase } from "../lib/supabase";
import { calculateProjectedScores, DataballrInput, getStandardTeamName } from "../lib/nbaUtils";
import { toast } from "sonner";
import { withRetry } from "../lib/resilience";

/**
 * Formata as métricas Databallr como bloco de texto para o prompt da IA.
 * Retorna string compacta tipo: ORTG=X | DRTG=X | NET=X | ...
 */
const formatDataballrTensor = (
  label: string,
  d: DataballrInput | null | undefined
): string => {
  if (!d?.ortg) return `[${label}] Tensor Databallr 14d: INDISPONÍVEL — usar PPG ESPN como fallback`;
  const parts: string[] = [
    `ORTG=${d.ortg.toFixed(1)}`,
    `DRTG=${d.drtg?.toFixed(1) ?? 'N/D'}`,
    `NET=${d.net_rating?.toFixed(1) ?? 'N/D'}`,
    d.pace ? `PACE=${d.pace.toFixed(1)}` : 'PACE=est.',
    `TS%=${d.o_ts?.toFixed(1) ?? 'N/D'}`,
    `TOV%=${d.o_tov?.toFixed(1) ?? 'N/D'}`,
    `OReb%=${d.orb?.toFixed(1) ?? 'N/D'}`,
    `DReb%=${d.drb?.toFixed(1) ?? 'N/D'}`,
    `Atq.Rel=${d.offense_rating?.toFixed(1) ?? 'N/D'}`,
    `Def.Rel=${d.defense_rating?.toFixed(1) ?? 'N/D'}`,
  ];
  return `[${label} — Databallr 14d] ${parts.join(' | ')}`;
};

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

/**
 * Lógica de Sanitização: Coerência Termodinâmica
 * Garante que o vencedor e a confiança estejam em sincronia matemática com os scores.
 */
interface ParsedAnalysis extends MatchupAnalysis {
  expectedScoreA: number;
  expectedScoreB: number;
  winner: string;
}

const enforceThermodynamicCoherence = (
  analysis: ParsedAnalysis,
  teamA: Team,
  teamB: Team
): ParsedAnalysis => {
  const { expectedScoreA, expectedScoreB } = analysis;

  // 1. Verificação de delta estrito
  const scoreDelta = expectedScoreA - expectedScoreB;

  // 2. Override determinístico do vencedor
  let coherentWinner = analysis.winner;
  if (scoreDelta > 0 && !analysis.winner.toLowerCase().includes(teamA.name.toLowerCase())) {
    coherentWinner = teamA.name;
    console.warn(`[ESTATÍSTICO_CHEFE] Correção de rota: ${teamA.name} assumido como vencedor.`);
  } else if (scoreDelta < 0 && !analysis.winner.toLowerCase().includes(teamB.name.toLowerCase())) {
    coherentWinner = teamB.name;
    console.warn(`[ESTATÍSTICO_CHEFE] Correção de rota: ${teamB.name} assumido como vencedor.`);
  }

  // 3. Recalibração de confiança baseada na margem de vitória
  const adjustedConfidence = Math.min(100, Math.max(50, 50 + (Math.abs(scoreDelta) * 2.5)));

  return {
    ...analysis,
    winner: coherentWinner,
    confidence: isNaN(adjustedConfidence) ? analysis.confidence : Math.round(adjustedConfidence)
  };
};

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
    defense_data: parseJSONField(data.defense_data, []),
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
      pick_total: analysis.pickTotal || null,
      result: 'pending',
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error(`[Supabase] Erro ao salvar análise para ${teamAId} vs ${teamBId}:`, error);
      throw error;
    }
  } catch (err) {
    console.error("[MATCHUP_HISTORY] Falha na persistência da análise:", err);
  }
};

export const compareTeams = async (
  teamA: Team,
  teamB: Team,
  playerStats: PlayerStat[],
  injuries: UnavailablePlayer[] = [],
  marketData?: MarketData | null,
  momentumData?: any,
  databallrA?: DataballrInput | null,
  databallrB?: DataballrInput | null,
  isHomeA: boolean = true  // <-- novo parâmetro, default true por retrocompatibilidade
): Promise<MatchupAnalysis> => {

  // Busca odds diretamente se marketData não foi fornecido (race condition no hook)
  let resolvedMarket = marketData;
  if (!resolvedMarket?.total) {
    try {
      const matchupKey = `${getStandardTeamName(teamB.name)} @ ${getStandardTeamName(teamA.name)}`;
      const { data: oddsData } = await supabase
        .from('nba_odds_matrix')
        .select('*')
        .eq('matchup', matchupKey)
        .maybeSingle();
      if (oddsData) resolvedMarket = oddsData;
    } catch (e) {
      console.warn('[compareTeams] Odds fetch fallback falhou:', e);
    }
  }

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

  const getPlayerWeight = (pts: number) => Math.floor((pts || 0) / 3);
  const mapInjToHW = (teamName: string, allInjuries: UnavailablePlayer[], allStats: PlayerStat[]) => {
    const teamStats = allStats.filter(s => (s.time || s.team_name || '').toLowerCase().includes(teamName.toLowerCase()));
    return teamStats.map(s => {
      const inj = allInjuries.find(i => (i.player_name || i.nome || '').toLowerCase() === (s.player_name || s.nome || '').toLowerCase());
      return {
        nome: s.player_name || s.nome || '',
        isOut: !!(inj?.injury_status || inj?.gravidade || '').toUpperCase().includes('OUT'),
        weight: getPlayerWeight(s.pontos || s.pts || 0)
      };
    });
  };

  const injuriesA = mapInjToHW(teamA.name, dbInjuries.data || injuries, dbStats.data || playerStats);
  const injuriesB = mapInjToHW(teamB.name, dbInjuries.data || injuries, dbStats.data || playerStats);

  // [EXTENSÃO DE CONTEXTO]: Buscar o formato gerado pelo Editor Sênior (Gemini Insight) no calendário
  const homeTeamLabel = isHomeA ? teamA.name : teamB.name;
  const awayTeamLabel = isHomeA ? teamB.name : teamA.name;
  const gameDate = momentumData?.date;

  // Como nem todos os times tem os mesmos padrões de nome na schedule, usamos um like simples no nome e data
  let scheduleQuery = supabase
    .from('nba_games_schedule')
    .select('gemini_insight')
    .ilike('home_team', `%${homeTeamLabel.split(' ').pop()}%`)
    .ilike('away_team', `%${awayTeamLabel.split(' ').pop()}%`);

  if (gameDate) {
    scheduleQuery = scheduleQuery.eq('game_date', gameDate);
  }

  const { data: scheduleData } = await scheduleQuery
    .order('game_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const editorInsight = scheduleData?.gemini_insight || null;


  // Extrair defenseData (H2H) do momentumData
  const baseH2H = momentumData?.defense_data || momentumData?.momentum_data?.home_vs_away;

  const { matchPace, totalPayload, kineticState, deltaA, deltaB, databallrEnhanced } =
    calculateProjectedScores(teamA, teamB, {
      isHomeA,
      injuriesA,
      injuriesB,
      powerA: notaA,
      powerB: notaB,
      editorInsight,
      defenseData: baseH2H // <-- Passagem do H2H corrigida
    }, databallrA, databallrB);

  const formA = typeof teamA.record === 'string' ? teamA.record : JSON.stringify(teamA.record || []);
  const formB = typeof teamB.record === 'string' ? teamB.record : JSON.stringify(teamB.record || []);
  const h2hContext = baseH2H && baseH2H.length > 0
    ? JSON.stringify(baseH2H)
    : "DADOS_H2H_INDISPONIVEIS";

  const projectedSpread = deltaB - deltaA;
  const marketSpread = resolvedMarket?.spread ?? null;
  let edgeBlock = "Market_Odds: Indisponível";
  if (marketSpread !== null) {
    const edge = Math.abs(projectedSpread - marketSpread);
    const classification = edge >= 3.0 ? "🔴 VALUE_BET DETECTADO" : "⚪ DENTRO DA MARGEM";
    edgeBlock = `Spread de Mercado: ${marketSpread} | Spread Projetado: ${projectedSpread.toFixed(1)} | Edge: ${edge.toFixed(1)} pts | ${classification}`;
  }

  const homeLabel = isHomeA ? teamA.name : teamB.name;
  const awayLabel = isHomeA ? teamB.name : teamA.name;
  const databallrModeTag = databallrEnhanced ? 'DATABALLR_ENHANCED_v3' : 'ESPN_FALLBACK_v2';
  const tensorA = formatDataballrTensor(`CASA ${homeLabel}`, databallrA);  // usa homeLabel para clareza
  const tensorB = formatDataballrTensor(`FORA ${awayLabel}`, databallrB);

  const prompt = `ALVO DE COMPUTAÇÃO: ${homeLabel} (CASA) vs ${awayLabel} (FORA). MODO: ${databallrModeTag}
  

  [VETOR 1: EFICIÊNCIA ESTRUTURAL]
  Rating AI ${teamA.name}: ${notaA.toFixed(1)}/5.0
  Rating AI ${teamB.name}: ${notaB.toFixed(1)}/5.0
  ${compactStandings}

  [VETOR 2: ALGORITMO CINÉTICO (v3.0)]
  Pace do Confronto: ${matchPace.toFixed(1)} (${kineticState})
  Pontuação Base ${teamA.name}: ${deltaA.toFixed(1)}
  Pontuação Base ${teamB.name}: ${deltaB.toFixed(1)}
  Total Projetado: ${totalPayload.toFixed(1)}

  [VETOR 3: ASSIMETRIA DE MERCADO]
  ${edgeBlock}
  Mercado (Total/ML): Total=${resolvedMarket?.total ?? 'N/D'} | ML Away=${resolvedMarket?.moneyline_away ?? 'N/D'} | ML Home=${resolvedMarket?.moneyline_home ?? 'N/D'}

  [VETOR 4: MOMENTO TERMODINÂMICO]
  Forma ${teamA.name} (Últimos 5): ${formA}
  Forma ${teamB.name} (Últimos 5): ${formB}
  Confronto Direto (H2H): ${h2hContext}

  [VETOR 5: INTEGRIDADE FÍSICA]
  ${compactInjuries}

  [VETOR 6: TENSOR DE EFICIÊNCIA DATABALLR (14 dias)]
  Instruções: Use este vetor como fonte primária de verdade para eficiência ofensiva/defensiva.
  ORTG = pontos marcados por 100 posses | DRTG = pontos sofridos por 100 posses | NET = saldo de dominância
  TS% = aproveitamento real de arremessos | TOV% = % posses desperdiçadas | OReb% = rebotes ofensivos
  Atq.Rel e Def.Rel = performance relativa à média da liga no período de 14 dias.
  ${tensorA}
  ${tensorB}

  [VETOR 7: INSIGHT TÁTICO E EDITORIAL (IA DE CONTEXTO)]
  ${editorInsight ? editorInsight : "Nenhum insight editorial pré-gerado associado a este confronto."}
  Instrução Crítica: O vetor de Insight Editorial carrega análises qualitativas de matchups, palpites e lesões cruciais. Sincronize a sua narração e análise de Key Factors/Detailed Analysis incorporando os fatores apontados por ele, caso haja sinergia com os dados quantitativos ou com as cotações de mercado (Exemplo: se o editor prevê um OVER, alinhe possíveis descrições táticas para endossar esse raciocínio).

  PROCESSE AS DIRETRIZES E RETORNE O JSON STRICT.`;

  try {
    const text = await withRetry(() => callGeminiProxy('compareTeams', prompt), { retries: 2, initialDelay: 500 });

    // Assepsia e extração
    const cleanJsonText = text.replace(/```json\n|```/g, '').trim();
    const rawAnalysisResult = JSON.parse(cleanJsonText);

    // Injeção da trava de segurança termodinâmica
    const coherentAnalysis = enforceThermodynamicCoherence(rawAnalysisResult, teamA, teamB);

    // Calcula pick_total (PREV_OVER/UNDER) direto na fonte
    let pickTotal: string | undefined;
    if (resolvedMarket?.total) {
      const diff = totalPayload - resolvedMarket.total;
      if (diff >= 3.5) {
        pickTotal = `PREV_OVER ${resolvedMarket.total}`;
      } else if (diff <= -3.5) {
        pickTotal = `PREV_UNDER ${resolvedMarket.total}`;
      } else {
        pickTotal = `PASS_TOTAL ${resolvedMarket.total}`;
      }
    }

    return { ...coherentAnalysis, sources: [], momentumData, pickTotal };
  } catch (error: any) {
    console.error(`[IA_ENGINE] Colapso na matriz vetorial para ${teamA.name} vs ${teamB.name}:`, error?.message || error);
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
  const compactStandings = formatStandingsForAI(teams);
  const prompt = `Gere insights estratégicos para a rodada NBA baseados nos seguintes dados reais de classificação e performance. 
  Foque no Momento Termodinâmico, Handicaps Positivos e Cansaço (B2B). 
  
  DADOS DE CLASSIFICAÇÃO:
  ${compactStandings}

  Instrução: Retorne um array JSON de objetos Insight [{title, content, type}].`;

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
