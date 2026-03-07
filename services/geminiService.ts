import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { Team, Insight, MatchupAnalysis, Source, PlayerStat, ESPNData, UnavailablePlayer } from "../types";
import { supabase } from "../lib/supabase";
import { calculateDeterministicPace } from "../lib/nbaUtils";
import { toast } from "sonner";
import { withRetry } from "../lib/resilience";

// Module-level singleton — avoids re-instantiation on every call
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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

const cleanJsonOutput = (text: string): string => {
  if (!text) return "[]";
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  clean = clean.replace(/\s*```$/, "");
  return clean;
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

const SYSTEM_INSTRUCTION = `Role: Você é o "Estatístico Chefe do NBA Hub". Operação estrita e brutalista.
DIRETRIZES ESTRATÉGICAS (MATRIZ DE IMPACTO V2.1 - UNDERDOG HANDICAP):

1. OBRIGAÇÃO DO RITMO (PACE):
   - Se o estado for HYPER_KINETIC, linhas abaixo de 225.5 são alvos prioritários para OVER.
   - Se o estado for SLOW_GRIND, repudie o OVER, mesmo com defesas comprometidas (Total Baixo favorece Underdog).

2. IMPACTO DE ESTRELAS: Se o melhor jogador do time não joga, o impacto é DRÁSTICO, a menos que o time seja "Elite" (Nota > 4.5).

3. MÉTODO HANDICAP POSITIVO (UNDERDOG):
   - Underdog_Casa: Underdogs jogando em casa (+7 a +12) tendem a competir mais. Favorito não costuma vencer por grande margem fora.
   - Favorito_Back_to_Back: Reduzir projeção do favorito em 2 a 3 pontos se jogou no dia anterior (Ajuste_Fadiga).
   - Blowout_Regressao: Se o favorito venceu o último jogo por >20 pontos, o mercado o supervaloriza. Gere valor no Underdog.
   - Defesa_Top15: Times com defesa forte evitam blowouts e mantêm o jogo competitivo. Favorito +7 vs Underdog -1 indica vantagem real.

4. REGRAS DE OURO COMPLEMENTARES:
   - Em confrontos equilibrados, prefira sempre sugerir Handicap Positivo (Handicap+).
   - Diferença entre linha da casa e sua projeção ≥ 3 pontos ≈ 58% chance (Value_Bet).`;

export const nbaTools: FunctionDeclaration[] = [
  {
    name: "get_standings",
    description: "Retorna a tabela de classificação da NBA.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.STRING, description: "Nome do time." },
        conf: { type: Type.STRING, description: "East ou West." }
      }
    }
  },
  {
    name: "get_injuries",
    description: "Busca a lista de jogadores lesionados.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        team_name: { type: Type.STRING, description: "Nome do time." }
      }
    }
  }
];

export const saveMatchupAnalysis = async (teamA: Team | number, teamB: Team | number, analysis: MatchupAnalysis) => {
  try {
    const teamAId = typeof teamA === 'number' ? teamA : teamA.id;
    const teamBId = typeof teamB === 'number' ? teamB : teamB.id;

    let cleanConfidence = Number(analysis.confidence);
    if (cleanConfidence <= 1) {
      cleanConfidence = Math.round(cleanConfidence * 100);
    } else {
      cleanConfidence = Math.round(cleanConfidence);
    }

    const { error } = await supabase.from('matchup_analyses').insert({
      team_a_id: teamAId,
      team_b_id: teamBId,
      winner: analysis.winner,
      confidence: cleanConfidence,
      key_factor: analysis.keyFactor,
      detailed_analysis: analysis.detailedAnalysis,
      sources: analysis.sources,
      result: 'pending', // GARANTIA DE MINÚSCULAS
      created_at: new Date().toISOString()
    });

    if (error) throw error;
  } catch (err) {
    console.error("Erro ao salvar histórico de análise no Supabase:", err);
    toast.error("Erro ao salvar histórico no banco de dados.");
  }
};

const fetchComparisonData = async (teamA: Team, teamB: Team) => {
  return await Promise.all([
    supabase.from('nba_jogadores_stats').select('*').in('time', [teamA.name, teamB.name]),
    supabase.from('nba_injured_players').select('*').in('team_name', [teamA.name, teamB.name]),
    supabase.from('classificacao_nba').select('*').in('time', [teamA.name, teamB.name]),
    supabase.from('tabela_notas').select('*').in('franquia', [teamA.name, teamB.name])
  ]);
};

const getExpectedPoints = (statsA: any, statsB: any) => {
  const atkA = Number(statsA.media_pontos_ataque || statsA.pts_ataque || 0);
  const defA = Number(statsA.media_pontos_defesa || statsA.pts_defesa || 0);
  const atkB = Number(statsB.media_pontos_ataque || statsB.pts_ataque || 0);
  const defB = Number(statsB.media_pontos_defesa || statsB.pts_defesa || 0);

  return {
    projA: atkA > 0 && defB > 0 ? ((atkA + defB) / 2).toFixed(1) : "N/D",
    projB: atkB > 0 && defA > 0 ? ((atkB + defA) / 2).toFixed(1) : "N/D"
  };
};

export const compareTeams = async (teamA: Team, teamB: Team, playerStats: PlayerStat[], injuries: UnavailablePlayer[] = []): Promise<MatchupAnalysis> => {
  const [dbStats, dbInjuries, dbStandings, dbNotas] = await fetchComparisonData(teamA, teamB);

  const notaA = Number(dbNotas.data?.find(n => n.franquia === teamA.name)?.nota_ia || teamA.ai_score || 0);
  const notaB = Number(dbNotas.data?.find(n => n.franquia === teamB.name)?.nota_ia || teamB.ai_score || 0);

  const compactStats = formatPlayerStatsForAI((dbStats.data || playerStats).slice(0, 15));
  const compactInjuries = formatInjuriesForAI(dbInjuries.data || injuries);
  const compactStandings = formatStandingsForAI(dbStandings.data || []);

  const statsA = dbStandings.data?.find(s => s.time === teamA.name) || {};
  const statsB = dbStandings.data?.find(s => s.time === teamB.name) || {};
  const { projA, projB } = getExpectedPoints(statsA, statsB);

  const schema = {
    type: Type.OBJECT,
    properties: {
      winner: { type: Type.STRING, description: "Vencedor sugerido ou Handicap (Lembre: prefira +10 ou -5, evite +5.5)" },
      confidence: { type: Type.NUMBER, description: "Confiança de 0 a 100" },
      keyFactor: { type: Type.STRING, description: "Justificativa curta baseada nas Regras de Ouro e Underdog Handicap" },
      detailedAnalysis: { type: Type.STRING, description: "Análise estratégica completa focada no impacto do Defensive Rating, B2B e Underdog Value." }
    },
    required: ["winner", "confidence", "keyFactor", "detailedAnalysis"]
  };

  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    responseSchema: schema,
    temperature: 0.1, // Deterministic: IA atua como calculadora estatística, não gerador de texto
  };

  const { matchPace, totalPayload, kineticState, deltaA, deltaB } = calculateDeterministicPace(teamA, teamB, {
    isHomeA: true, // No context de comparação direta, Home/Away depende da UI, mas passamos a análise base
  });

  const prompt = `Analise NBA Confronto: ${teamA.name} vs ${teamB.name}.
  
  📊 POWER RANKING / NÍVEL DA EQUIPE (Escala de 2.0 a 5.0):
  - ${teamA.name}: ${notaA.toFixed(1)}/5.0
  - ${teamB.name}: ${notaB.toFixed(1)}/5.0

  ALGORITMO DE RITMO E COLISÃO ESTATÍSTICA v2.2 (Ajustado):
  - Pace do Confronto: ${matchPace.toFixed(1)} (${kineticState})
  - Pontuação Esperada ${teamA.name}: ${deltaA.toFixed(1)}
  - Pontuação Esperada ${teamB.name}: ${deltaB.toFixed(1)}
  - Payload Total Projetado: ${totalPayload.toFixed(1)}

  CLASSIFICAÇÃO E MOMENTUM:
  ${compactStandings}

  DADOS DOS JOGADORES (ESTRELAS):
  ${compactStats}
  
  RELATÓRIO DE DESFALQUES:
  ${compactInjuries}
  
  APLIQUE AS REGRAS UNDERDOG HANDICAP:
  - Fator 'kineticState': ${kineticState}. Total Projetado: ${totalPayload.toFixed(1)}.
  - Se SLOW_GRIND (<98 Pace), a vantagem do Underdog aumenta.
  - Verifique 'Favorito_Back_to_Back' na SEQ (Streak) do favorito.
  - Verifique 'Defesa_Top15' nos PTS- (Pontos sofridos) das equipes.
  - Procure por 'Blowout_Regressao' se o favorito vem de vitória esmagadora.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash",
      contents: prompt,
      config
    }), { retries: 3 });

    if (!response.text) throw new Error("Empty response");
    // Native structured output — no regex cleaning needed
    const analysis = JSON.parse(response.text);
    analysis.sources = extractSources(response);
    return analysis;
  } catch (error: any) {
    if (error.status === 403) {
      toast.error("Erro de permissão no Gemini AI.");
      throw new Error("PERMISSION_DENIED");
    }
    console.error("Erro na análise da IA (CompareTeams):", error);
    toast.error("Erro ao processar análise da IA.");
    throw error;
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

  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    responseSchema: schema,
    temperature: 0.1, // Deterministic statistical reasoning
  };

  try {
    const prompt = "Gere insights baseados nas Regras de Ouro (Handicaps, Over por Defesa Ruim e Cansaço).";
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash",
      contents: prompt,
      config
    }), { retries: 2, initialDelay: 500 });

    if (!response.text) throw new Error("EMPTY_PAYLOAD");
    // Native structured output — no regex cleaning needed
    const insights: Insight[] = JSON.parse(response.text);
    const sources = extractSources(response);
    if (insights.length > 0 && sources.length > 0) insights[0].sources = sources;
    return insights;
  } catch (error) {
    console.error("[IA_ENGINE] Colapso na matriz de processamento:", error);
    // Graceful degradation: mantém a UI operacional mesmo com a IA inativa
    return [{
      title: "SYSTEM_WARNING: IA OFFLINE",
      content: "Motor de inferência temporariamente indisponível. Analise os dados brutos no HUD inferior.",
      type: "warning"
    }];
  }
};

