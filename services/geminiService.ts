import { Type } from "@google/genai";
import { Team, Insight, MatchupAnalysis, Source, PlayerStat, ESPNData, UnavailablePlayer, MarketData } from "../types";
import { supabase } from "../lib/supabase";
import { calculateProjectedScores, DataballrInput, getStandardTeamName } from "../lib/nbaUtils"; // ← V5.5
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
  teamB: Team,
  confidenceModifier: number = 0
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
  let adjustedConfidence = Math.min(100, Math.max(50, 50 + (Math.abs(scoreDelta) * 2.5)));

  // [PLAYOFFS] Aplica modificadores de confiança (ex: Dreno de Intensidade)
  if (confidenceModifier !== 0) {
    const penaltyValue = Math.abs(confidenceModifier) < 1 ? confidenceModifier * 100 : confidenceModifier;
    adjustedConfidence += penaltyValue;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SYS-OP] CONFIANÇA AJUSTADA: ${adjustedConfidence.toFixed(1)}% (Modificador: ${penaltyValue})`);
    }
  }

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
  isHomeA: boolean = true
): Promise<MatchupAnalysis> => {

  // Busca odds diretamente se marketData não foi fornecido
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

  // [V5.5] Mapeamento de injuries com isDayToDay e playedLastGame
  const getPlayerWeight = (pts: number) => Math.floor((pts || 0) / 3);
  const mapInjToHW = (teamName: string, allInjuries: UnavailablePlayer[], allStats: PlayerStat[]) => {
    const teamStats = allStats.filter(s => (s.time || s.team_name || '').toLowerCase().includes(teamName.toLowerCase()));
    return teamStats.map(s => {
      const inj = allInjuries.find(i => 
        (i.player_name || i.nome || '').toLowerCase() === (s.player_name || s.nome || '').toLowerCase()
      );

      const status = (inj?.injury_status || inj?.gravidade || '').toUpperCase();
      const isOut = status.includes('OUT');
      const isDayToDay = status.includes('DAY-TO-DAY') || status.includes('DTD') || status.includes('QUESTIONABLE');

      // [V5.5] Campo novo: verificar se jogou último jogo
      // REQUER: coluna 'played_last_game' (boolean) na tabela nba_injured_players
      const playedLastGame = (inj as any)?.played_last_game ?? false;

      return {
        nome: s.player_name || s.nome || '',
        isOut,
        isDayToDay,         // [V5.5] NOVO: necessário para floor dinâmico
        weight: getPlayerWeight(s.pontos || s.pts || 0),
        playedLastGame      // [V5.5] NOVO: necessário para floor DTD condicional
      };
    });
  };

  const injuriesA = mapInjToHW(teamA.name, dbInjuries.data || injuries, dbStats.data || playerStats);
  const injuriesB = mapInjToHW(teamB.name, dbInjuries.data || injuries, dbStats.data || playerStats);

  // [V5.5 + TACTICAL_PREDICTION]: Buscar a previsão da redação no calendário
  const homeTeamLabel = isHomeA ? teamA.name : teamB.name;
  const awayTeamLabel = isHomeA ? teamB.name : teamA.name;
  const gameDate = momentumData?.date;

  // Busca pela data do jogo e nomes dos times na nba_games_schedule.
  // Usa nome completo no ilike para evitar falsos positivos por última palavra
  // (ex: "Clippers" bateria tanto em "LA Clippers" quanto em dados sujos).
  let scheduleQuery = supabase
    .from('nba_games_schedule')
    .select('tactical_prediction, game_date, home_team, away_team')
    .ilike('home_team', `%${homeTeamLabel}%`)
    .ilike('away_team', `%${awayTeamLabel}%`);

  if (gameDate) {
    scheduleQuery = scheduleQuery.eq('game_date', gameDate);
  }

  const { data: scheduleData } = await scheduleQuery
    .limit(1)
    .maybeSingle();

  if (!scheduleData) {
    console.warn(`[V5.5] Nenhuma entrada na schedule para "${homeTeamLabel}" vs "${awayTeamLabel}"${gameDate ? ` em ${gameDate}` : ''}. editorInsight e seriesScore serão nulos.`);
  }

  // [V5.5] tactical_prediction = previsão da redação (contexto editorial)
  const rawEditorInsight: string | null = scheduleData?.tactical_prediction || null;

  // Sanitização: remove whitespace excessivo, trunca em 500 chars para não poluir o prompt
  const sanitizeText = (text: string, max = 500): string =>
    text.replace(/\s+/g, ' ').trim().slice(0, max);

  const editorInsight: string | null = rawEditorInsight
    ? sanitizeText(rawEditorInsight)
    : null;

  // [V5.5] Usar nomes exatos da schedule para busca de série
  const scheduleHome = scheduleData?.home_team || homeTeamLabel;
  const scheduleAway = scheduleData?.away_team || awayTeamLabel;

  // [V5.5] BUSCAR JOGOS DA SÉRIE PARA TREND DETECTION
  const { data: seriesGamesData } = await supabase
    .from('game_predictions')
    .select('home_team, away_team, home_score, away_score, date')
    .or(`and(home_team.eq.${scheduleHome},away_team.eq.${scheduleAway}),and(home_team.eq.${scheduleAway},away_team.eq.${scheduleHome})`)
    .order('date', { ascending: true });

  const seriesGames = (seriesGamesData || []).map(g => ({
    score: `${g.home_score}-${g.away_score}`,
    home_team: g.home_team,
    away_team: g.away_team
  }));

  // [V5.5] Extrair placar da série
  const seriesScore = momentumData?.series_score || calculateSeriesScore(seriesGames, scheduleHome, scheduleAway);

  // [V5.5] Detectar playoff via tactical_prediction (menciona "playoffs", "série", "round")
  const isPlayoffGame = detectPlayoffFromText(editorInsight) || momentumData?.is_playoff || false;

  // Extrair defenseData (H2H) do momentumData
  const baseH2H = momentumData?.defense_data || momentumData?.momentum_data?.home_vs_away;

  // [V5.6] Sinal editorial extraído como feature estruturada — não apenas texto no prompt
  const editorialLean = {
    expectsOver:  /over|pontuação alta|ritmo alto|ofensivo/i.test(editorInsight || ''),
    expectsUnder: /under|defesa|placar baixo|grind|lento/i.test(editorInsight || ''),
    favorsHome:   new RegExp(homeTeamLabel.split(' ').pop() || homeTeamLabel, 'i').test(editorInsight || ''),
    favorsAway:   new RegExp(awayTeamLabel.split(' ').pop() || awayTeamLabel, 'i').test(editorInsight || ''),
  };

  // [V5.5] Chamada ao kernel com todos os novos parâmetros
  const { 
    matchPace, totalPayload, kineticState, deltaA, deltaB, 
    databallrEnhanced, isPlayoff,
    h2hWeightUsed, seriesTrendGrind, seriesAvgTotal, eliminationApplied
  } = calculateProjectedScores(teamA, teamB, {
    isHomeA,
    injuriesA,
    injuriesB,
    powerA: notaA,
    powerB: notaB,
    editorInsight,
    defenseData: baseH2H,
    seriesGames,        // [V5.5] NOVO: jogos completos da série para trend detection
    seriesScore,        // [V5.5] NOVO: placar da série (ex: "2-3")
    isPlayoff: isPlayoffGame, // [V5.5] NOVO: flag explícita
  }, databallrA, databallrB);

  const formA = typeof teamA.record === 'string' ? teamA.record : JSON.stringify(teamA.record || []);
  const formB = typeof teamB.record === 'string' ? teamB.record : JSON.stringify(teamB.record || []);
  const h2hContext = baseH2H && baseH2H.length > 0
    ? JSON.stringify(baseH2H)
    : "DADOS_H2H_INDISPONIVEIS";

  const projectedSpread = deltaB - deltaA;
  const marketSpread = resolvedMarket?.spread ?? null;
  const marketTotal = resolvedMarket?.total ?? null;

  let edgeBlock = "Market_Odds: Indisponível";
  if (marketSpread !== null) {
    const edgeSpread = Math.abs(projectedSpread - marketSpread);
    const classificationSpread = edgeSpread >= 3.0 ? "🔴 VALUE_BET DETECTADO" : "⚪ DENTRO DA MARGEM";
    edgeBlock = `Spread de Mercado: ${marketSpread} | Spread Projetado: ${projectedSpread.toFixed(1)} | Edge Spread: ${edgeSpread.toFixed(1)} pts | ${classificationSpread}`;
  }

  // Regra 3: Cálculo de Edge de Mercado (Total)
  let marketEdgeLabel = "sem edge claro";
  if (marketTotal !== null) {
    const floor = totalPayload - 5;
    const ceiling = totalPayload + 5;

    if (marketTotal < floor) marketEdgeLabel = "OVER valorizado";
    else if (marketTotal > ceiling) marketEdgeLabel = "UNDER valorizado";

    edgeBlock += `\nTotal Mercado: ${marketTotal} | Total Projetado: ${totalPayload.toFixed(1)} | Classificação Total: ${marketEdgeLabel}`;
  }


  const homeLabel = isHomeA ? teamA.name : teamB.name;
  const awayLabel = isHomeA ? teamB.name : teamA.name;
  const databallrModeTag = databallrEnhanced ? 'DATABALLR_ENHANCED_v3' : 'ESPN_FALLBACK_v2';
  const tensorA = formatDataballrTensor(`CASA ${homeLabel}`, databallrA);
  const tensorB = formatDataballrTensor(`FORA ${awayLabel}`, databallrB);

  // [V5.6] BLOCO DE DEBUG para o prompt da IA
  const v55DebugInfo = `
[DEBUG V5.6 KERNEL]
H2H Weight Aplicado: ${h2hWeightUsed}
Série em Grind: ${seriesTrendGrind ? 'SIM (avg < 205)' : 'NÃO'}
Média Total da Série: ${seriesAvgTotal > 0 ? seriesAvgTotal.toFixed(1) : 'N/A'}
Elimination Applied: ${eliminationApplied ? 'SIM (+4.5% underdog)' : 'NÃO'}
Série Atual: ${seriesScore}
Modo Playoff: ${isPlayoff ? 'ATIVO' : 'INATIVO'}
Editorial Lean: OVER=${editorialLean.expectsOver} | UNDER=${editorialLean.expectsUnder} | Favorece Casa=${editorialLean.favorsHome} | Favorece Fora=${editorialLean.favorsAway}
`;

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

  [VETOR 6.5: DIAGNÓSTICO DO KERNEL V5.5]
  ${v55DebugInfo}

  [VETOR 7: INSIGHT TÁTICO E EDITORIAL (PREVISÃO DA REDAÇÃO)]
  ${editorInsight ?? "Nenhuma previsão editorial pré-gerada associada a este confronto."}
  Instrução Crítica: O vetor de Previsão da Redação carrega análises qualitativas de matchups, palpites e lesões cruciais. Sincronize a sua narração e análise de Key Factors/Detailed Analysis incorporando os fatores apontados por ele, caso haja sinergia com os dados quantitativos ou com as cotações de mercado (Exemplo: se o editor prevê um OVER, alinhe possíveis descrições táticas para endossar esse raciocínio).

  PROCESSE AS DIRETRIZES E RETORNE O JSON STRICT.`;

  try {
    const text = await withRetry(() => callGeminiProxy('compareTeams', prompt), { retries: 2, initialDelay: 500 });

    // Assepsia e extração
    const cleanJsonText = text.replace(/```json\n|```/g, '').trim();

    let rawAnalysisResult: any;
    try {
      rawAnalysisResult = JSON.parse(cleanJsonText);
    } catch (e) {
      console.error('[IA_ENGINE] JSON inválido recebido da IA:', cleanJsonText.slice(0, 300));
      throw new Error('INVALID_JSON_FROM_AI');
    }

    // [V5.5] REMOVIDO confidenceModifier — não existe no retorno do V5.5
    const coherentAnalysis = enforceThermodynamicCoherence(rawAnalysisResult, teamA, teamB, 0);

    // Calcula pick_total (PREV_OVER/UNDER) direto na fonte
    let pickTotal: string | undefined;
    if (resolvedMarket?.total) {
      const diff = totalPayload - resolvedMarket.total;
      if (diff >= 5.0) {
        pickTotal = `PREV_OVER ${resolvedMarket.total}`;
      } else if (diff <= -5.0) {
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

// ==========================================
// [V5.5] FUNÇÕES AUXILIARES
// ==========================================

/**
 * Detecta se é jogo de playoff pela previsão da redação (tactical_prediction).
 * Busca palavras-chave como "playoffs", "série", "eliminação", "round", "conferência".
 */
const detectPlayoffFromText = (text: string | null): boolean => {
  if (!text) return false;
  const playoffKeywords = /playoff|pós-temporada|round|série|eliminação|conferência|finais|game\s?[1-7]/i;
  return playoffKeywords.test(text);
};

/**
 * Calcula o placar da série (ex: "2-3") a partir dos jogos anteriores.
 * Usa os nomes dos times da schedule para garantir match correto.
 */
const calculateSeriesScore = (
  games: Array<{ score: string; home_team: string; away_team: string }>,
  teamAName: string,
  teamBName: string
): string => {
  if (!games || games.length === 0) return '0-0';

  let winsA = 0, winsB = 0;

  // Extrair última palavra do nome para matching mais flexível
  const getLastWord = (name: string) => name.toLowerCase().split(' ').pop() || '';
  const teamAKey = getLastWord(teamAName);
  const teamBKey = getLastWord(teamBName);

  games.forEach(g => {
    const parts = g.score.split('-');
    if (parts.length < 2) return;
    const homeScore = parseInt(parts[0].trim());
    const awayScore = parseInt(parts[1].trim());
    if (isNaN(homeScore) || isNaN(awayScore)) return;

    const homeKey = getLastWord(g.home_team);

    // Warn se o home_team não bate com nenhum dos dois times esperados
    if (homeKey !== teamAKey && homeKey !== teamBKey) {
      console.warn(`[calculateSeriesScore] Matching ambíguo — jogo ignorado:`, {
        home_team: g.home_team,
        away_team: g.away_team,
        score: g.score,
        esperado_A: teamAName,
        esperado_B: teamBName,
      });
      return;
    }

    // Determinar qual time é qual
    const isTeamAHome = homeKey === teamAKey || g.home_team.toLowerCase().includes(teamAKey);
    const isTeamBHome = homeKey === teamBKey || g.home_team.toLowerCase().includes(teamBKey);

    if (homeScore > awayScore) {
      if (isTeamAHome) winsA++;
      else if (isTeamBHome) winsB++;
    } else {
      if (isTeamAHome) winsB++;
      else if (isTeamBHome) winsA++;
    }
  });

  return `${winsA}-${winsB}`;
};
