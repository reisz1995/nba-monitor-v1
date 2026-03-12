import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Team, Insight, MatchupAnalysis, Source, PlayerStat, ESPNData, UnavailablePlayer, MarketData } from "../types";
import { supabase } from "../lib/supabase";
import { calculateDeterministicPace } from "../lib/nbaUtils";
import { toast } from "sonner";
import { withRetry } from "../lib/resilience";

// Motor GenAI Isolado - Evita re-instanciação
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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

const extractSources = (response: GenerateContentResponse): Source[] => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: Source[] = [];
  chunks.forEach((chunk: any) => {
    if (chunk.web?.uri && chunk.web?.title) {
      if (!sources.find(s => s.url === chunk.web.uri)) {
        sources.push({ title: chunk.web.title, url: chunk.web.uri });
      }
    }
  });
  return sources;
};

// ==========================================
// 2. DIRETRIZES DO ESTATÍSTICO CHEFE (CORE INSTRUCTION)
// ==========================================
const SYSTEM_INSTRUCTION = `Role: Você é o "Estatístico Chefe do NBA Hub". Operação estrita, brutalista e puramente matemática. Não narre jogos. Emita sentenças técnicas e frias.

DIRETRIZES ESTRATÉGICAS UNIFICADAS (MATRIZ V3.0):

[VETOR 1: RITMO E COLISÃO (PACE)]
- Nunca analise Over/Under usando apenas médias nominais. Use o Fator Cinético.
- HYPER_KINETIC: Linhas abaixo de 225.5 são alvos prioritários para OVER.
- SLOW_GRIND / STATIC_TRENCH: Repudie o OVER. Total baixo favorece sempre o Underdog.

[VETOR 2: MOMENTO TERMODINÂMICO (PRIORIDADE ALFA)]
- DRENO TÉRMICO: Se uma equipa possui 'result': 'D' nos últimos 3 jogos do Momentum, aplique uma severa penalização de confiança (-25%).
- DOMÍNIO H2H: Equipas com vitórias recentes esmagadoras no H2H (Confronto Direto) sobrepujam métricas de Pace isoladas.

[VETOR 3: ASSIMETRIA DE MERCADO E UNDERDOG]
- VALUE BET: Se a sua projeção (Edge) divergir fortemente do Mercado (>= 1.0 pontos no Spread ou Total), classifique o keyFactor como 'VALUE_BET DETECTADO'.
- Underdog_Casa: Underdogs jogando em casa (+8 a +14) tendem a competir mais. Favorito não costuma vencer por grande margem fora.
- Favorito_Back_to_Back: Aplique Dreno de Fadiga. Reduza a projeção do favorito em 1 a 2 pontos.
- Blowout_Regressao: Favorito venceu o último jogo por >35 pontos? O mercado supervaloriza-o. Gere valor no Underdog.
- Defesa Top: Defesas de elite (PTS sofridos < 109.5) anulam blowouts.

[VETOR 4: INTEGRIDADE FÍSICA]
- Ausência da Estrela Alfa HW >= 7 (Jokic, SGA, Doncic, etc) causa colapso sistêmico imediato, exceto se a equipa tiver Rating > 4.5.`;

// ==========================================
// 3. MOTORES DE CÁLCULO E INFERÊNCIA
// ==========================================

// Função para buscar o jogo e efetuar JOIN seguro com a tabela teams
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

  // Busca os records usando os nomes dos times (já que não há chave estrangeira)
  const { data: teamsData } = await supabase
    .from('teams')
    .select('name, record')
    .in('name', [data.home_team, data.away_team]);

  const homeTeamData = teamsData?.find(t => t.name === data.home_team);
  const awayTeamData = teamsData?.find(t => t.name === data.away_team);

  // Parsing seguro de JSONB
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

  // Extração assíncrona da infraestrutura
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

  // PARSING TERMODINÂMICO (MOMENTUM & H2H)
  const formA = typeof teamA.record === 'string' ? teamA.record : JSON.stringify(teamA.record || []);
  const formB = typeof teamB.record === 'string' ? teamB.record : JSON.stringify(teamB.record || []);
  const h2hContext = momentumData?.momentum_data?.home_vs_away && momentumData.momentum_data.home_vs_away.length > 0
    ? JSON.stringify(momentumData.momentum_data.home_vs_away)
    : "DADOS_H2H_INDISPONIVEIS";

  // EDGE CALCULATION (MERCADO)
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

  const schema = {
    type: Type.OBJECT,
    properties: {
      winner: { type: Type.STRING },
      confidence: { type: Type.NUMBER },
      keyFactor: { type: Type.STRING },
      detailedAnalysis: { type: Type.STRING },
      expectedScoreA: { type: Type.NUMBER },
      expectedScoreB: { type: Type.NUMBER },
      projectedPace: { type: Type.NUMBER }
    },
    required: ["winner", "confidence", "keyFactor", "detailedAnalysis", "expectedScoreA", "expectedScoreB", "projectedPace"]
  };

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    }), { retries: 2, initialDelay: 500 });

    if (!response.text) throw new Error("COLAPSO_PAYLOAD_NULO");
    const analysisResult = JSON.parse(response.text);
    return { ...analysisResult, sources: extractSources(response), momentumData };
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
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['prediction', 'analysis', 'warning'] }
      },
      required: ["title", "content", "type"]
    }
  };

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Gere insights baseados no Momento Termodinâmico, Handicaps Positivos e Cansaço (B2B).",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    }), { retries: 2, initialDelay: 500 });

    if (!response.text) throw new Error("EMPTY_PAYLOAD");
    const insights: Insight[] = JSON.parse(response.text);
    const sources = extractSources(response);
    if (insights.length > 0 && sources.length > 0) insights[0].sources = sources;
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
