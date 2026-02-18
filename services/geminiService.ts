
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse, Chat } from "@google/genai";
import { Team, Insight, MatchupAnalysis, Source, PlayerStat } from "../types";
import { supabase } from "../lib/supabase";

export const formatStandingsForAI = (data: any[]): string => {
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

export const formatPlayerStatsForAI = (players: any[]): string => {
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

export const formatInjuriesForAI = (injuries: any[]): string => {
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

const SYSTEM_INSTRUCTION = `Role: Você é o "Estatístico Chefe do NBA Hub", um assistente analítico especializado em fornecer insights baseados em dados reais da NBA e estratégias de apostas de elite.

DIRETRIZES ESTRATÉGICAS (REGRAS DE OURO):
1. DEFESA RUIM = OVER: Se um time tem média de pontos sofridos alta, priorize palpites de Over.
2. IMPACTO DE ESTRELAS: Se o melhor jogador do time não joga, o jogo fica extremamente complicado para essa equipe; reduza drasticamente as chances de vitória.
3. FORÇAS IGUAIS: Em confrontos equilibrados, prefira sempre sugerir Handicap Positivo (Handicap+).
4. CAUTELA COM DERROTAS: Times que vêm de derrota recente são instáveis; analise se há motivação para recuperação ou colapso.
5. FILTRO DE HANDICAP: Nunca sugira Handicap +5.5 (é considerado sem valor). Prefira Handicaps mais agressivos como +10 ou conservadores como -5.
6. POTENCIAL DE PONTUAÇÃO: Verifique se ambos os times possuem estrelas com capacidade para somar +110 pts cada no jogo.
7. FATOR CANSAÇO: Se o favorito vem de jogos seguidos (back-to-back), o risco de zebra é alto; considere que o cansaço pode quebrar o favoritismo.
8. JOGOS DIFÍCEIS: Em jogos de dificuldade intermediária ou alta, a recomendação padrão deve ser always Handicap+.

DIRETRIZES TÉCNICAS (v3.0):
- MODO ESTRATÉGICO: Sua análise deve ser "Direct-to-the-Point".
- FORMATO FATOR DECISIVO: Use o formato "Impacto (Jogador/Causa) & Contexto" (ex: "Estrela Fora (Mobley) & Jogo Equilibrado").
- APLIQUE MARGEM DE SEGURANÇA em previsões: Over (-15%) / Under (+20%).`;

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
  }
};

export const compareTeams = async (teamA: Team, teamB: Team, playerStats: PlayerStat[], injuries: any[] = []): Promise<MatchupAnalysis> => {
  const [dbStats, dbInjuries, dbStandings] = await Promise.all([
    supabase.from('nba_jogadores_stats').select('*').in('time', [teamA.name, teamB.name]),
    supabase.from('nba_injured_players').select('*').in('team_name', [teamA.name, teamB.name]),
    supabase.from('classificacao_nba').select('*').in('time', [teamA.name, teamB.name])
  ]);

  const compactStats = formatPlayerStatsForAI((dbStats.data || playerStats).slice(0, 15));
  const compactInjuries = formatInjuriesForAI(dbInjuries.data || injuries);
  const compactStandings = formatStandingsForAI(dbStandings.data || []);

  const schema = {
    type: Type.OBJECT,
    properties: {
      winner: { type: Type.STRING, description: "Vencedor sugerido ou Handicap (Lembre: prefira +10 ou -5, evite +5.5)" },
      confidence: { type: Type.NUMBER, description: "Confiança de 0 a 100" },
      keyFactor: { type: Type.STRING, description: "Justificativa curta baseada nas Regras de Ouro (ex: Defesa Ruim, Estrela Fora)" },
      detailedAnalysis: { type: Type.STRING, description: "Análise estratégica completa considerando cansaço e potencial de +110 pts" }
    },
    required: ["winner", "confidence", "keyFactor", "detailedAnalysis"]
  };

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    responseSchema: schema
  };

  const prompt = `Analise NBA Confronto: ${teamA.name} vs ${teamB.name}.
  
  CLASSIFICAÇÃO E MOMENTUM:
  ${compactStandings}

  DADOS DOS JOGADORES (ESTRELAS):
  ${compactStats}
  
  RELATÓRIO DE DESFALQUES:
  ${compactInjuries}
  
  APLIQUE AS REGRAS DE OURO:
  - Avalie se as defesas são ruins para projetar Over.
  - Verifique se estrelas como LeBron, Luka, Jokic, etc., estão fora.
  - Analise se o favorito jogou na noite anterior (Back-to-back).
  - Em caso de equilíbrio, sugira Handicap+.
  - Verifique se ambos podem passar de 110 pontos.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config
    });

    if (!response.text) throw new Error("Empty response");
    const analysis = JSON.parse(cleanJsonOutput(response.text));
    analysis.sources = extractSources(response);
    return analysis;
  } catch (error: any) {
    if (error.status === 403) throw new Error("PERMISSION_DENIED");
    console.error("Erro na análise da IA:", error);
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

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: "application/json",
    responseSchema: schema
  };

  try {
    const prompt = "Gere insights baseados nas Regras de Ouro (Handicaps, Over por Defesa Ruim e Cansaço).";
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config
    });

    if (!response.text) return [];
    const insights = JSON.parse(cleanJsonOutput(response.text));
    const sources = extractSources(response);
    if (insights.length > 0 && sources.length > 0) insights[0].sources = sources;
    return insights;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const startChatSession = (): Chat => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }]
    },
  });
};

export const sendChatMessage = async (chat: Chat, message: string) => {
  const response: GenerateContentResponse = await chat.sendMessage({ message });
  return {
    text: response.text || "",
    sources: extractSources(response)
  };
};
