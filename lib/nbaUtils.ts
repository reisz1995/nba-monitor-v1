
import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number; // Margin of last game (+ for win, - for loss)
    lastMarginB?: number;
}

/**
 * Input de métricas avançadas do Databallr (últimos 14 dias).
 * Todas as props são opcionais — quando ausentes, o motor usa fallback ESPN/PPG.
 */
export interface DataballrInput {
    /** Offensive Rating: pontos marcados por 100 posses */
    ortg?: number;
    /** Defensive Rating: pontos sofridos por 100 posses */
    drtg?: number;
    /** Posses por 48 minutos (pode ser nulo se pipeline não preencheu) */
    pace?: number | null;
    /** True Shooting % × 100 */
    o_ts?: number;
    /** Turnover Ratio (% de posses que terminam em erro) */
    o_tov?: number;
    /** Offensive Rebound % */
    orb?: number;
    /** Defensive Rebound % */
    drb?: number;
    /** Net Rating = ortg - drtg */
    net_rating?: number;
    /** Ataque relativo à média da liga */
    offense_rating?: number;
    /** Defesa relativa à média da liga */
    defense_rating?: number;
}

// Liga NBA 2025-26: valores de referência para normalização
const LEAGUE_AVG_ORTG = 115.5;
const LEAGUE_AVG_PACE = 99.7;
const LEAGUE_AVG_TOV = 14.8;

// CONFIGURAÇÃO DE PARÂMETROS DO MOTOR (NBA MONITOR v3.5)
const NBA_CONFIG = {
    WEIGHTS: {
        RECENT: 0.6,    // Pesagem para os últimos 14 dias (Databallr)
        SEASON: 0.4     // Pesagem para a média da temporada (ESPN)
    },
    LIMITS: {
        MIN_PACE: 100.5,
        MAX_PACE: 110.5,
        SCORE_FLOOR_DIFF: 12, // Máximo de queda permitida vs média da temporada
        ELITE_DEFENSE_THRESHOLD: 109.5,
        UNDERDOG_VALUE_EDGE: 4.5
    },
    ADJUSTMENTS: {
        HOME_ADVANTAGE: 1.5,
        B2B_FATIGUE: 2.0,
        BLOWOUT_REGRESSION: 2.5,
        TS_VARIANCE_FACTOR: 0.15,
        TOV_PENALTY_FACTOR: 0.3,
        OREB_BONUS_FACTOR: 0.2,
        SUPERIORITY_BONUS: 3.0
    },
    THRESHOLDS: {
        BLOWOUT_MARGIN: 20,
        OREB_ELITE_PCT: 26,
        PACE_SLOW_THRESHOLD: 98,
        PACE_HYPER_THRESHOLD: 102.5
    },
    DEFENSE_FILTER: [
        { min: 120, adj: 4 },
        { min: 117, adj: 2 },
        { min: 113, adj: 0 },
        { max: 112.99, adj: -2 }
    ]
};

/**
 * ALGORITMO DE RITMO E COLISÃO ESTATÍSTICA v3.0 (DATABALLR_ENHANCED)
 *
 * Quando stats do Databallr estiverem disponíveis, usa ORTG/DRTG reais como base
 * de eficiência cruzada, calculando posses por 48min como proxy de pace.
 * Fallback automático para PPG ESPN quando dados estiverem ausentes.
 */

// Sub-rotina de estabilização: Mescla a temporada completa com os últimos 14 dias
const getFallbackPace = (team: Team): number => {
    const offRtg = Number(team.espnData?.pts || team.stats?.media_pontos_ataque || 115.5);
    return offRtg / (LEAGUE_AVG_ORTG / 100);
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    // 1. Captura a âncora macro (Temporada)
    // Assuma que 'team.pace' ou sua função de fallback retorna o Pace da ESPN
    const seasonPace = (team as any).pace || getFallbackPace(team);

    // 2. Captura a âncora micro (14 Dias)
    const recentPace = databallr?.pace;

    // 3. Executa a média ponderada se ambos os vetores existirem (60% Recente, 40% Temporada)
    if (recentPace && recentPace > 0) {
        return (recentPace * NBA_CONFIG.WEIGHTS.RECENT) + (seasonPace * NBA_CONFIG.WEIGHTS.SEASON);
    }

    // Fallback de segurança: Se o Databallr falhar, retorna apenas a temporada
    return seasonPace;
};

export const calculateDeterministicPace = (
    teamA: Team,
    teamB: Team,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
): number => {
    // 1. Extração da Identidade Híbrida de cada equipe
    const blendedPaceA = getBlendedPace(teamA, databallrA);
    const blendedPaceB = getBlendedPace(teamB, databallrB);

    // 2. Fusão Termodinâmica do Confronto
    let projectedPace = ((blendedPaceA + blendedPaceB) / 2) + 1.8;

    // 3. Grampo Térmico (Clamp) - Limites da Realidade Física da NBA
    const clampedPace = Math.max(NBA_CONFIG.LIMITS.MIN_PACE, Math.min(NBA_CONFIG.LIMITS.MAX_PACE, projectedPace));

    console.log(`[SYS-OP] Híbrido A: ${blendedPaceA.toFixed(1)} | Híbrido B: ${blendedPaceB.toFixed(1)}`);
    console.log(`[SYS-OP] Pace Projetado (Clamped): ${clampedPace.toFixed(2)}`);

    return clampedPace;
};

export const calculateProjectedScores = (
    entityA: Team,
    entityB: Team,
    options?: PaceOptions & {
        injuriesA?: { nome: string, isOut: boolean, weight: number }[],
        injuriesB?: { nome: string, isOut: boolean, weight: number }[],
        aiScoreA?: number,
        aiScoreB?: number
    },
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
) => {
    const hasDataballr = !!(databallrA?.ortg && databallrB?.ortg);

    // 1. Resolver Ratings Base (Weighted 60/40)
    let { offRtgA, defRtgA, offRtgB, defRtgB } = getInherentRatings(entityA, entityB, hasDataballr, databallrA, databallrB);

    // 2. Cálculo do Pace
    const matchPace = calculateDeterministicPace(entityA, entityB, databallrA, databallrB);

    // 3. Projeção Inicial via Eficiência Cruzada
    let projectedScoreA: number;
    let projectedScoreB: number;

    if (hasDataballr) {
        // V3.0: usa ORTG real → converte em pontos esperados via pace
        const effA = (offRtgA + defRtgB) / 2;
        const effB = (offRtgB + defRtgA) / 2;
        projectedScoreA = (effA / 100) * matchPace;
        projectedScoreB = (effB / 100) * matchPace;

        // Ajustes finos do Databallr (TS%, TOV, OReb)
        const tsAvgLeague = 58.0;
        if (databallrA!.o_ts) projectedScoreA += (databallrA!.o_ts - tsAvgLeague) * NBA_CONFIG.ADJUSTMENTS.TS_VARIANCE_FACTOR;
        if (databallrB!.o_ts) projectedScoreB += (databallrB!.o_ts - tsAvgLeague) * NBA_CONFIG.ADJUSTMENTS.TS_VARIANCE_FACTOR;

        if (databallrA!.o_tov && databallrA!.o_tov > LEAGUE_AVG_TOV) {
            projectedScoreA -= (databallrA!.o_tov - LEAGUE_AVG_TOV) * NBA_CONFIG.ADJUSTMENTS.TOV_PENALTY_FACTOR;
        }
        if (databallrB!.o_tov && databallrB!.o_tov > LEAGUE_AVG_TOV) {
            projectedScoreB -= (databallrB!.o_tov - LEAGUE_AVG_TOV) * NBA_CONFIG.ADJUSTMENTS.TOV_PENALTY_FACTOR;
        }

        if (databallrA!.orb && databallrA!.orb > NBA_CONFIG.THRESHOLDS.OREB_ELITE_PCT) {
            projectedScoreA += (databallrA!.orb - NBA_CONFIG.THRESHOLDS.OREB_ELITE_PCT) * NBA_CONFIG.ADJUSTMENTS.OREB_BONUS_FACTOR;
        }
        if (databallrB!.orb && databallrB!.orb > NBA_CONFIG.THRESHOLDS.OREB_ELITE_PCT) {
            projectedScoreB += (databallrB!.orb - NBA_CONFIG.THRESHOLDS.OREB_ELITE_PCT) * NBA_CONFIG.ADJUSTMENTS.OREB_BONUS_FACTOR;
        }
    } else {
        projectedScoreA = ((offRtgA + defRtgB) / 2.0) * (matchPace / 100.0);
        projectedScoreB = ((offRtgB + defRtgA) / 2.0) * (matchPace / 100.0);
    }

    // Aplicação de Jogo Frio/Quente da Rodada
    const LEAGUE_ENVIRONMENT = {
        avgTotalLastGames: 232 // dinâmico
    };
    const environmentBoost = (LEAGUE_ENVIRONMENT.avgTotalLastGames - 225) * 0.35;
    projectedScoreA += environmentBoost / 2;
    projectedScoreB += environmentBoost / 2;

    // 4. Aplicação de Ajustes Situacionais (Mandante, B2B, Blowout, Ritmo Lento)
    const scores = applySituationalAdjustments(projectedScoreA, projectedScoreB, matchPace, options);
    projectedScoreA = scores.scoreA;
    projectedScoreB = scores.scoreB;

    // 5. Filtro de Defesa (Ajustes de Pontos Fixos)
    projectedScoreA = applyDefensiveAdjustment(projectedScoreA, defRtgB);
    projectedScoreB = applyDefensiveAdjustment(projectedScoreB, defRtgA);

    // 6. Bônus de Superioridade (v3.2)
    const superiorityScores = applySuperiorityBonuses(projectedScoreA, projectedScoreB, entityA, entityB, options, databallrA, databallrB);
    projectedScoreA = superiorityScores.scoreA;
    projectedScoreB = superiorityScores.scoreB;

    // 7. Penalidades de Integridade Física
    projectedScoreA -= calculateInjuryPenalty(options?.injuriesA);
    projectedScoreB -= calculateInjuryPenalty(options?.injuriesB);

    // 8. Trava de Segurança Final
    projectedScoreA = applyIntegrityFloor(projectedScoreA, entityA);
    projectedScoreB = applyIntegrityFloor(projectedScoreB, entityB);

    const totalPayload = projectedScoreA + projectedScoreB;

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > NBA_CONFIG.THRESHOLDS.PACE_HYPER_THRESHOLD ? 'HYPER_KINETIC' : (matchPace < NBA_CONFIG.THRESHOLDS.PACE_SLOW_THRESHOLD ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: hasDataballr,
    };
};

/**
 * SUB-ROTINAS DE PROJEÇÃO (REATOR ESTATÍSTICO)
 */

function getInherentRatings(entityA: Team, entityB: Team, hasDataballr: boolean, databallrA?: DataballrInput | null, databallrB?: DataballrInput | null) {
    let offRtgA = Number(entityA.espnData?.pts || entityA.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    let defRtgA = Number(entityA.espnData?.pts_contra || entityA.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);
    let offRtgB = Number(entityB.espnData?.pts || entityB.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    let defRtgB = Number(entityB.espnData?.pts_contra || entityB.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);

    if (hasDataballr) {
        if (databallrA?.ortg) offRtgA = (databallrA.ortg * NBA_CONFIG.WEIGHTS.RECENT) + (offRtgA * NBA_CONFIG.WEIGHTS.SEASON);
        if (databallrA?.drtg) defRtgA = (databallrA.drtg * NBA_CONFIG.WEIGHTS.RECENT) + (defRtgA * NBA_CONFIG.WEIGHTS.SEASON);
        if (databallrB?.ortg) offRtgB = (databallrB.ortg * NBA_CONFIG.WEIGHTS.RECENT) + (offRtgB * NBA_CONFIG.WEIGHTS.SEASON);
        if (databallrB?.drtg) defRtgB = (databallrB.drtg * NBA_CONFIG.WEIGHTS.RECENT) + (defRtgB * NBA_CONFIG.WEIGHTS.SEASON);
    }

    return { offRtgA, defRtgA, offRtgB, defRtgB };
}

function applySituationalAdjustments(scoreA: number, scoreB: number, matchPace: number, options?: PaceOptions) {
    let sA = scoreA;
    let sB = scoreB;

    // Vantagem de Casa
    if (options?.isHomeA) {
        sA += NBA_CONFIG.ADJUSTMENTS.HOME_ADVANTAGE;
        sB -= NBA_CONFIG.ADJUSTMENTS.HOME_ADVANTAGE;
    } else {
        sB += NBA_CONFIG.ADJUSTMENTS.HOME_ADVANTAGE;
        sA -= NBA_CONFIG.ADJUSTMENTS.HOME_ADVANTAGE;
    }

    // Fadiga B2B
    if (options?.isB2BA) sA -= NBA_CONFIG.ADJUSTMENTS.B2B_FATIGUE;
    if (options?.isB2BB) sB -= NBA_CONFIG.ADJUSTMENTS.B2B_FATIGUE;

    // Regressão de Blowout
    if (options?.lastMarginA && options.lastMarginA > NBA_CONFIG.THRESHOLDS.BLOWOUT_MARGIN) sA += NBA_CONFIG.ADJUSTMENTS.BLOWOUT_REGRESSION;
    if (options?.lastMarginB && options.lastMarginB > NBA_CONFIG.THRESHOLDS.BLOWOUT_MARGIN) sB += NBA_CONFIG.ADJUSTMENTS.BLOWOUT_REGRESSION;

    // Ajuste de Jogo Lento
    if (matchPace < NBA_CONFIG.THRESHOLDS.PACE_SLOW_THRESHOLD) {
        const spread = sA - sB;
        const adjustment = spread * 0.02;
        sA -= adjustment / 2;
        sB += adjustment / 2;
    }

    return { scoreA: sA, scoreB: sB };
}

function applyDefensiveAdjustment(score: number, opponentDefRtg: number): number {
    let newScore = score;
    for (const rule of NBA_CONFIG.DEFENSE_FILTER) {
        if (rule.min && opponentDefRtg >= rule.min) {
            newScore += rule.adj;
            break;
        }
        if (rule.max && opponentDefRtg <= rule.max) {
            newScore += rule.adj;
            break;
        }
    }
    return newScore;
}

function applySuperiorityBonuses(scoreA: number, scoreB: number, entityA: Team, entityB: Team, options: any, databallrA?: DataballrInput | null, databallrB?: DataballrInput | null) {
    let sA = scoreA;
    let sB = scoreB;

    const effAiA = options?.aiScoreA ?? entityA.ai_score ?? 0;
    const effAiB = options?.aiScoreB ?? entityB.ai_score ?? 0;

    if (databallrA && databallrB && effAiA !== effAiB) {
        const offA = databallrA.offense_rating ?? 0;
        const offB = databallrB.offense_rating ?? 0;
        const defA = databallrA.defense_rating ?? 0;
        const defB = databallrB.defense_rating ?? 0;

        if (Math.abs(offA - offB) >= 1) {
            if (offA > offB) {
                sA += NBA_CONFIG.ADJUSTMENTS.SUPERIORITY_BONUS;
                console.log(`[NOTAS] +5 para ${entityA.name} (Ataque Superior)`);
            } else {
                sB += NBA_CONFIG.ADJUSTMENTS.SUPERIORITY_BONUS;
                console.log(`[NOTAS] +5 para ${entityB.name} (Ataque Superior)`);
            }
        }

        if (Math.abs(defA - defB) >= 1) {
            if (defA > defB) {
                sA += NBA_CONFIG.ADJUSTMENTS.SUPERIORITY_BONUS;
                console.log(`[NOTAS] +5 para ${entityA.name} (Defesa Superior)`);
            } else {
                sB += NBA_CONFIG.ADJUSTMENTS.SUPERIORITY_BONUS;
                console.log(`[NOTAS] +5 para ${entityB.name} (Defesa Superior)`);
            }
        }
    }
    return { scoreA: sA, scoreB: sB };
}

function calculateInjuryPenalty(injuries?: { isOut: boolean, weight: number }[]): number {
    let penalty = 0;
    (injuries || []).forEach(inj => {
        if (inj.isOut) penalty += inj.weight;
    });
    return penalty;
}

function applyIntegrityFloor(projectedScore: number, team: Team): number {
    const seasonAvg = Number(team.espnData?.pts || team.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    const floor = seasonAvg - NBA_CONFIG.LIMITS.SCORE_FLOOR_DIFF;

    if (projectedScore < floor) {
        console.log(`[SAFE-LOCK] Acionado para ${team.name}: ${projectedScore.toFixed(1)} -> ${floor.toFixed(1)}`);
        return floor;
    }
    return projectedScore;
}

/**
 * Calculates a momentum score based on the weighted recent results.
 * Wins later in the sequence (more recent) have higher weights.
 */
export const getMomentumScore = (record: GameResult[]) => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null ? (res as any).result : res;
        return score + (rStr === 'V' ? Math.pow(2, idx) : 0);
    }, 0);
};

/**
 * Parses an ESPN streak string (e.g., 'W4' or 'V-V-D-V-D') into a GameResult array of length 5.
 */
export const parseStreakToRecord = (streakStr: string): GameResult[] | null => {
    if (!streakStr) return null;

    // Handle 'W4' or 'L3' format
    const match = streakStr.match(/([WLVD])(\d+)/i);
    if (match && match[1] && match[2]) {
        const type = (match[1] as string).toUpperCase();
        const count = Math.min(parseInt(match[2] as string, 10), 5);
        const winChar = (type === 'W' || type === 'V') ? 'V' : 'D';
        const lossChar = winChar === 'V' ? 'D' : 'V';
        const record: GameResult[] = new Array(5).fill(lossChar);
        for (let i = 0; i < count; i++) {
            record[4 - i] = winChar;
        }
        return record;
    }

    // Handle 'V-V-D-V-D' format
    const chars = streakStr.match(/[VDWL]/g);
    if (chars && chars.length > 0) {
        let results = chars.map(c => (c === 'W' || c === 'V' ? 'V' : 'D')) as GameResult[];
        if (results.length > 5) results = results.slice(-5);
        while (results.length < 5) results.unshift(results[0] === 'V' ? 'D' : 'V');
        return results;
    }

    return null;
};

/**
 * Retorna a data formatada como DD/MM/YYYY.
 */
export const getFormattedDate = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

/**
 * Calcula o peso do jogador baseado nos pontos.
 */
export const getPlayerWeight = (pts: number): number => Math.floor((pts || 0) / 3);

/**
 * Encontra um time na lista pelo nome (busca flexível).
 */
export const findTeamByName = (name: string, teams: any[]): any | null => {
    if (!name) return null;
    const clean = normalizeTeamName(name);
    return teams.find(t =>
        normalizeTeamName(t.name) === clean ||
        normalizeTeamName(t.name).includes(clean) ||
        clean.includes(normalizeTeamName(t.name))
    );
};

/**
 * Retorna o nome padronizado do time para busca em fontes externas (odds/mercado).
 * Ex: "LA Clippers" -> "Los Angeles Clippers"
 */
export const getStandardTeamName = (name: string): string => {
    if (!name) return '';
    const n = name.trim();
    if (n === 'LA Clippers') return 'Los Angeles Clippers';
    return n;
};

/**
 * Normaliza o nome do time (remove acentos e espaços extras).
 */
export const normalizeTeamName = (name: string): string => {
    if (!name) return '';
    const standard = getStandardTeamName(name);
    return standard.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

/**
 * Verifica se um time jogou ontem ou jogará amanhã (Back-to-Back).
 */
export const checkB2B = (teamName: string, dateStr: string, dbPredictions: any[]) => {
    if (!dbPredictions || !teamName) return { yesterday: false, tomorrow: false };

    const [d, m, y] = dateStr.split('/');
    const current = new Date(parseInt(y || '0'), parseInt(m || '1') - 1, parseInt(d || '1'));

    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];

    const playedYesterday = dbPredictions.some(p =>
        (p.home_team?.toLowerCase().includes(teamName?.toLowerCase() || '') ||
            p.away_team?.toLowerCase().includes(teamName?.toLowerCase() || '')) &&
        p.date === yStr
    );

    const playsTomorrow = dbPredictions.some(p =>
        (p.home_team?.toLowerCase().includes(teamName?.toLowerCase() || '') ||
            p.away_team?.toLowerCase().includes(teamName?.toLowerCase() || '')) &&
        p.date === tStr
    );

    return { yesterday: playedYesterday, tomorrow: playsTomorrow };
};

/**
 * ALGORITMO DE VALOR DE UNDERDOG RESTRITO v3.0
 * Identifica se o confronto possui valor em Underdog baseado em regras endurecidas
 * e classificação por Power Ranking (tabela_notas).
 */
export const calculateUnderdogValue = (
    teamCasa: Team,
    teamFora: Team,
    analysis: any,
    marketSpread: number | null,
    notaCasa?: string | null,
    notaFora?: string | null
) => {
    if (marketSpread === null) return null;

    const rules = [];
    const isUnderdogA = marketSpread > 0; // Se spread > 0 para o time da casa (A), ele é underdog
    const fairSpread = analysis.deltaB - analysis.deltaA;
    const edge = marketSpread - fairSpread;

    // 1. Matriz de Classificação por Notas (Power Ranking)
    const getLevel = (notaStr: string | null | undefined) => {
        const nota = parseFloat(notaStr || '0');
        if (nota >= 4.5) return { level: '01', type: 'ELITE', label: 'CONTENDER' };
        if (nota >= 4.0) return { level: '02', type: 'COMPETITOR', label: 'ELITE' };
        if (nota >= 3.0) return { level: '03', type: 'MID-TIER', label: 'UNDERDOG' };
        return { level: '04', type: 'REBUILDING', label: 'AZARAO' };
    };

    const lvlCasa = getLevel(notaCasa);
    const lvlFora = getLevel(notaFora);

    // Identifica se o Underdog tem "Pedigree" (Nível 3 ou 4)
    const dogTarget = isUnderdogA ? lvlCasa : lvlFora;
    if (dogTarget.level === '03' || dogTarget.level === '04') {
        rules.push(`${dogTarget.label}_TIER`);
    }

    // Regra: Underdog_Casa
    if (isUnderdogA) rules.push('Underdog_Casa');

    // Vector 2: Endurecimento de Gatilhos
    const defA = Number(teamCasa.espnData?.pts_contra || teamCasa.stats?.media_pontos_defesa || 115);
    if (defA < NBA_CONFIG.LIMITS.ELITE_DEFENSE_THRESHOLD) rules.push('Defesa_Forte');

    if (analysis.totalPayload < 210) rules.push('Total_Baixo');

    // Vector 3: Exigência Matemática Bruta (A borda necessária salta de 3 para 4.5 pts)
    if (Math.abs(edge) >= NBA_CONFIG.LIMITS.UNDERDOG_VALUE_EDGE) rules.push('Value_Bet');

    // 4. Cálculo de Kelly Criterion se houver Edge
    let kelly = null;
    if (Math.abs(edge) > 0) {
        // Estimar probabilidade de cobertura baseada na diferença entre Fair e Market
        // P(Cover) = 1 / (1 + 10^( (MarketSpread - FairSpread) / -20 ))?
        // Vamos usar a probabilidade do Fair Spread vs Market
        const prob = estimateWinProbability(fairSpread, marketSpread);
        kelly = calculateKellyCriterion(prob, 1.91); // Odds padrão -110
    }

    return {
        hasValue: rules.length >= 2,
        rules,
        edge: edge.toFixed(1),
        kelly,
        levels: { home: lvlCasa, away: lvlFora }
    };
};

/**
 * Estima a probabilidade de vitória/cobertura baseada no Fair Line e Market Line.
 * Baseado no modelo logístico: P = 1 / (1 + 10^(spread / 20))
 */
export const estimateWinProbability = (fairLine: number, marketLine: number): number => {
    // Calculamos a vantagem (Edge) em termos de spread
    const edge = marketLine - fairLine;
    // A probabilidade de ganhar em 50/50 é quando marketLine = fairLine
    // Se fairLine é -5.8 e marketLine é -2.5, temos um edge de +3.3 a nosso favor
    // Convertendo o Fair Line bruto para probabilidade e ajustando pelo Edge
    const pFair = 1 / (1 + Math.pow(10, fairLine / 20));
    return pFair;
};

/**
 * Critério de Kelly: f = (bp - q) / b
 * b = Odds - 1
 * p = Probabilidade de ganhar
 * q = Probabilidade de perder
 */
export const calculateKellyCriterion = (p: number, odds: number = 1.91) => {
    const b = odds - 1;
    const q = 1 - p;
    const f = (b * p - q) / b;

    if (f <= 0) return null;

    return {
        full: f,
        half: f * 0.5,
        quarter: f * 0.25,
        tenth: f * 0.10
    };
};

/**
 * Converte uma string de score "112-105" no total de pontos (217).
 */
export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0] || '0', 10);
    const pts2 = parseInt(parts[1] || '0', 10);
    if (isNaN(pts1) || isNaN(pts2)) return 0;
    return pts1 + pts2;
};

/**
 * ALGORITMO PACE V2: Ritmo de Confronto baseado em histórico recente.
 * Calcula o ritmo médio dos últimos 5 jogos de cada time e dos últimos 2 H2H.
 */
export const calculateMatchupPaceV2 = (teamA: Team, teamB: Team) => {
    const PACE_FACTOR = LEAGUE_AVG_ORTG / 100;

    const getGamePace = (score: string) => parseScoreToTotal(score) / (2 * PACE_FACTOR);

    // 1. Média do Pace nos últimos 5 jogos do Time A
    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0
        ? last5A.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5A.length
        : 0;

    // 2. Média do Pace nos últimos 5 jogos do Time B
    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0
        ? last5B.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5B.length
        : 0;

    // 3. Média dos últimos 2 H2H (Confrontos Diretos)
    const normB = normalizeTeamName(teamB.name);
    const h2hGames = (teamA.record || []).filter(g =>
        g.opponent && normalizeTeamName(g.opponent || '').includes(normB)
    ).slice(-2);

    let avgPaceH2H = 0;
    let hasH2H = h2hGames.length > 0;

    if (hasH2H) {
        avgPaceH2H = h2hGames.reduce((sum, g) => sum + getGamePace(g.score), 0) / h2hGames.length;
    } else if (avgPace5A > 0 && avgPace5B > 0) {
        // Fallback: se não houver H2H, usamos a média dos últimos 5 dos dois times
        avgPaceH2H = (avgPace5A + avgPace5B) / 2;
    }

    // 4. Cálculo Final: Média ponderada (ou simples conforme interpretado)
    let finalPace = 0;
    if (avgPace5A > 0 && avgPace5B > 0 && avgPaceH2H > 0) {
        finalPace = (avgPace5A + avgPace5B + avgPaceH2H) / 3;
    }

    return {
        matchPace: finalPace,
        avgPace5A,
        avgPace5B,
        avgPaceH2H,
        hasH2H
    };
};
