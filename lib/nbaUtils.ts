import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number;
    lastMarginB?: number;
    aiScoreA?: number;
    aiScoreB?: number;
}

export interface DataballrInput {
    ortg?: number;
    drtg?: number;
    pace?: number | null;
    o_ts?: number;
    o_tov?: number;
    orb?: number;
    drb?: number;
    net_rating?: number;
    offense_rating?: number;
    defense_rating?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD DE CONFIGURAÇÃO - TEMPORADA 2025-26
// Estatístico Chefe: Parâmetros base atualizados para o metagame atual.
// ─────────────────────────────────────────────────────────────────────────────
const SEASON_25_26_METRICS = {
    AVG_ORTG: 115.5,
    AVG_PACE: 99.3,
    AVG_TOV: 14.8,
    AVG_TS: 58.8,
    MIN_PACE: 95.0,
    MAX_PACE: 104.0,
    AVG_ORB: 23.5
} as const;

const PROJECTION_CONFIG = {
    // Peso da diferença de Power Score (IA). 
    // 0.85 significa que se a IA vê 3 pontos de diferença, ela adiciona ~2.5 pts ao score.
    POWER_DIFF_WEIGHT: 0.85,

    // Quando o favorito tem a melhor defesa, ele suprime o adversário com mais força.
    DEF_FILTER_FAVORITE_MULT: 20,

    // Quando o underdog tem a melhor defesa, ele consegue segurar o favorito, mas menos que o inverso.
    DEF_FILTER_UNDERDOG_MULT: 1.4,

    // Bônus para quem tem ataque superior. Mantido próximo de 1.0 para não inflar o total.
    ATK_FILTER_MULT: 10,

    // Vantagem de casa. Como seu código soma no Home e subtrai no Away, 
    // 1.75 cria um "Swing" total de 3.5 pontos (valor padrão da NBA moderna).
    HOME_ADVANTAGE: 1.75,

    // Margem a partir da qual o jogo anterior é considerado um 'Blowout'.
    LAST_MARGIN_THRESHOLD: 22,

    // Penalidade de 'estagnação' após uma vitória esmagadora (ajuste psicológico/eficiência).
    LAST_MARGIN_PENALTY: 1.5,

    // Piso absoluto. Times da NBA raramente fazem menos de 92 pts na era atual.
    SCORE_FLOOR_MIN: 92,

    // Teto absoluto para evitar anomalias do algoritmo em jogos hiper-cinéticos.
    SCORE_CEILING_MAX: 148,

    // Fator de compressão de spread em jogos lentos. 
    // 0.03 significa que 3% da diferença de pontos é redistribuída para equilibrar o jogo.
    PACE_ADJUSTMENT_FACTOR: 0.03,

    // Limite de Pace para considerar o jogo como "Slow Grind".
    PACE_THRESHOLD_SLOW: 97.5
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE BLEND DINÂMICO
// Aloca pesos estocásticos baseados na divergência da amostra recente.
// ─────────────────────────────────────────────────────────────────────────────
const getDynamicBlendWeights = (
    recentRtg: number,
    seasonRtg: number
): { recentW: number; seasonW: number } => {
    const divergence = Math.abs(recentRtg - seasonRtg);
    if (divergence > 12) return { recentW: 0.50, seasonW: 0.50 }; // Alerta de Outlier
    if (divergence > 8) return { recentW: 0.60, seasonW: 0.40 }; // Instabilidade Alta
    if (divergence > 5) return { recentW: 0.70, seasonW: 0.30 }; // Divergência Padrão
    return { recentW: 0.80, seasonW: 0.20 }; // Conformidade
};

const getImpliedPaceNorm = (seasonPPG: number): number => {
    const impliedPace = seasonPPG / (SEASON_25_26_METRICS.AVG_ORTG / 100);
    return impliedPace / 100;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSISTEMA DE PACE
// ─────────────────────────────────────────────────────────────────────────────
const getFallbackPace = (team: Team): number => {
    const offRtg = team.espnData?.pts || team.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG;
    return offRtg / (SEASON_25_26_METRICS.AVG_ORTG / 100);
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    const recentPace = databallr?.pace;

    if (recentPace && recentPace > 0) {
        // Utiliza apenas a tabela databallr_team_stats (14 dias)
        return recentPace;
    }

    // Fallback puro para a média da liga atual se a amostragem de 14 dias falhar.
    // Ignorando `espnData` completamente garantir que não haja distorção da temporada inteira.
    return SEASON_25_26_METRICS.AVG_PACE;
};

export const calculateDeterministicPace = (
    teamA: Team,
    teamB: Team,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null,
    injuriesA?: { isOut: boolean; isDayToDay?: boolean; weight: number }[],
    injuriesB?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]
): number => {
    const blendedPaceA = getBlendedPace(teamA, databallrA);
    const blendedPaceB = getBlendedPace(teamB, databallrB);

    let projectedPace = (blendedPaceA + blendedPaceB) / 1.9;

    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || [])
            .filter(i => i.isOut && i.weight >= 7)
            .reduce((sum) => sum + 0.05, 0); // Ajuste fino para 2025-26

    projectedPace -= injuryPaceReduction(injuriesA);
    projectedPace -= injuryPaceReduction(injuriesB);

    const clampedPace = projectedPace;

    console.log(`[SYS-OP] Híbrido A: ${blendedPaceA.toFixed(1)} | Híbrido B: ${blendedPaceB.toFixed(1)}`);
    console.log(`[SYS-OP] Pace Otimizado (Interação): ${clampedPace.toFixed(2)}`);

    return clampedPace;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS E PENALIDADES
// ─────────────────────────────────────────────────────────────────────────────

const getOffenseRatingAnchor = (offenseRating?: number): number => {
    if (offenseRating === undefined || offenseRating === null) return 0;
    if (offenseRating < -8) return offenseRating * 0.25;
    if (offenseRating > 8) return offenseRating * 0.15;
    return 0;
};

const calculatePenalty = (
    injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]
): number => {
    let p = 0;
    (injuries || []).forEach(inj => {
        if (inj.isOut) {
            p += inj.weight >= 9 ? (inj.weight * 2.0) + 2 : inj.weight;
        } else if (inj.isDayToDay) {
            p += inj.weight * 0.10;
        }
    });
    return p;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS PARA MOTOR DE PROJEÇÃO
// ─────────────────────────────────────────────────────────────────────────────

const getTeamRatings = (entity: Team, databallr?: DataballrInput | null) => {
    const ppg = Number(entity.espnData?.pts || entity.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG);
    const def = Number(entity.espnData?.pts_contra || entity.stats?.media_pontos_defesa || SEASON_25_26_METRICS.AVG_ORTG);
    const pace = Number(entity.espnData?.pace) || getFallbackPace(entity);

    const seasonOrtg = (ppg / pace) * 100;
    const seasonDrtg = (def / pace) * 100;

    return {
        offRtg: databallr?.ortg || seasonOrtg,
        defRtg: databallr?.drtg || seasonDrtg,
        seasonPPG: ppg
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL DE PROJEÇÃO (v4.4) - RECONSTRUTOR MODULAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aplica ajustes baseados no contexto do jogo (margens anteriores e ritmo).
 */
const applyContextualAdjustments = (
    scoreA: number,
    scoreB: number,
    matchPace: number,
    options?: PaceOptions
) => {
    let adjA = scoreA;
    let adjB = scoreB;

    // 1. Penalidade por cansaço em B2B (Back-to-Back)
    if (options?.isB2BA) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.isB2BB) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;

    // 2. Penalidade por blowout recente
    if (options?.lastMarginA && options.lastMarginA > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) {
        adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    }
    if (options?.lastMarginB && options.lastMarginB > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) {
        adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    }

    // 3. Ajuste de spread em ritmo lento
    if (matchPace < PROJECTION_CONFIG.PACE_THRESHOLD_SLOW) {
        const spread = adjA - adjB;
        const adjustment = spread * PROJECTION_CONFIG.PACE_ADJUSTMENT_FACTOR;
        adjA -= adjustment;
        adjB += adjustment;
    }

    return { adjA, adjB };
};

/**
 * Helper para aplicar bônus de ataque e penalidade de defesa baseado em superioridade.
 */
const applyTeamSuperiority = (
    targetScore: number,
    opponentScore: number,
    targetRtg: { offRtg: number; defRtg: number },
    opponentRtg: { offRtg: number; defRtg: number },
    isFavorite: boolean
) => {
    let adjTarget = targetScore;
    let adjOpponent = opponentScore;

    // Filtro de Defesa: Se a defesa do alvo é melhor que a do oponente, suprime o ataque do oponente
    if (targetRtg.defRtg < opponentRtg.defRtg) {
        const mult = isFavorite ? PROJECTION_CONFIG.DEF_FILTER_FAVORITE_MULT : PROJECTION_CONFIG.DEF_FILTER_UNDERDOG_MULT;
        const defenseFilter = (opponentRtg.defRtg - targetRtg.defRtg) * mult;
        adjOpponent -= defenseFilter;
    }

    // Filtro de Ataque: Se o ataque do alvo é melhor que o do oponente, ganha bônus
    if (targetRtg.offRtg > opponentRtg.offRtg) {
        const attackFilter = (targetRtg.offRtg - opponentRtg.offRtg) * PROJECTION_CONFIG.ATK_FILTER_MULT;
        adjTarget += attackFilter;
    }

    return { adjTarget, adjOpponent };
};

const applySuperiorityFilters = (
    scoreA: number,
    scoreB: number,
    teamA: Team,
    teamB: Team,
    rtgA: { offRtg: number; defRtg: number },
    rtgB: { offRtg: number; defRtg: number },
    powerA: number,
    powerB: number
) => {
    let adjA = scoreA;
    let adjB = scoreB;
    const powerDiff = powerA - powerB;

    if (powerA > powerB) {
        adjA += powerDiff * PROJECTION_CONFIG.POWER_DIFF_WEIGHT;
        const { adjTarget, adjOpponent } = applyTeamSuperiority(adjA, adjB, rtgA, rtgB, true);
        adjA = adjTarget;
        adjB = adjOpponent;
    } else if (powerB > powerA) {
        adjB += Math.abs(powerDiff) * PROJECTION_CONFIG.POWER_DIFF_WEIGHT;
        const { adjTarget, adjOpponent } = applyTeamSuperiority(adjB, adjA, rtgB, rtgA, false);
        adjB = adjTarget;
        adjA = adjOpponent;
    }

    return { adjA, adjB };
};

const applyVolatilityFilter = (
    scoreA: number,
    scoreB: number,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null,
    powerA: number = 0,
    powerB: number = 0
) => {
    let adjA = scoreA;
    let adjB = scoreB;

    const netA = databallrA?.net_rating ?? NaN;
    const netB = databallrB?.net_rating ?? NaN;
    const hasValidNet = !isNaN(Number(netA)) && !isNaN(Number(netB));

    if (powerA > 0 && powerB > 0 && powerA <= 3.5 && powerB <= 3.5 && hasValidNet) {
        adjA += Math.abs(Number(netB));
        adjB += Math.abs(Number(netA));
    }

    return { adjA, adjB };
};

const clampScores = (scoreA: number, scoreB: number, floorA: number, floorB: number) => {
    return {
        finalA: Math.max(floorA, PROJECTION_CONFIG.SCORE_FLOOR_MIN, Math.min(PROJECTION_CONFIG.SCORE_CEILING_MAX, scoreA)),
        finalB: Math.max(floorB, PROJECTION_CONFIG.SCORE_FLOOR_MIN, Math.min(PROJECTION_CONFIG.SCORE_CEILING_MAX, scoreB))
    };
};

/**
 * Motor de Projeção Principal
 */
export const calculateProjectedScores = (
    teamA: Team,
    teamB: Team,
    options?: PaceOptions & {
        injuriesA?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
        injuriesB?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
    },
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
) => {
    const rtgA = getTeamRatings(teamA, databallrA);
    const rtgB = getTeamRatings(teamB, databallrB);

    const matchPace = calculateDeterministicPace(
        teamA, teamB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB
    );

    // 1. Eficiência Cruzada Ajustada (Base)
    let projA = ((rtgA.offRtg + rtgB.defRtg) / 2) * (matchPace / 100);
    let projB = ((rtgB.offRtg + rtgA.defRtg) / 2) * (matchPace / 100);

    // 2. Ajustes Contextuais (B2B, Blowouts e Pace)
    const context = applyContextualAdjustments(projA, projB, matchPace, options);
    projA = context.adjA;
    projB = context.adjB;

    // 3. Filtros de Superioridade (Power Score, Defesa e Ataque)
    const superiority = applySuperiorityFilters(
        projA, projB,
        teamA, teamB, rtgA, rtgB,
        options?.aiScoreA ?? 0, options?.aiScoreB ?? 0
    );
    projA = superiority.adjA;
    projB = superiority.adjB;

    // 4. Filtro de Volatilidade
    const volatility = applyVolatilityFilter(
        projA, projB,
        databallrA, databallrB,
        options?.aiScoreA, options?.aiScoreB
    );
    projA = volatility.adjA;
    projB = volatility.adjB;

    // 5. Mando de Quadra
    const homeAdv = PROJECTION_CONFIG.HOME_ADVANTAGE;
    if (options?.isHomeA) {
        projA += homeAdv;
        projB -= homeAdv;
    } else {
        projB += homeAdv;
        projA -= homeAdv;
    }

    // 6. Penalidades de Lesões
    projA -= calculatePenalty(options?.injuriesA);
    projB -= calculatePenalty(options?.injuriesB);

    // 7. Clamping e Limites Finais
    const { finalA, finalB } = clampScores(
        projA, projB,
        rtgA.seasonPPG - 30, rtgB.seasonPPG - 30
    );

    const totalPayload = finalA + finalB;
    console.log(`[v4.4] ${teamA.name}: ${finalA.toFixed(1)} | ${teamB.name}: ${finalB.toFixed(1)} | Payload: ${totalPayload.toFixed(1)}`);

    return {
        matchPace,
        totalPayload,
        deltaA: finalA,
        deltaB: finalB,
        kineticState: matchPace > 105.5
            ? 'HYPER_KINETIC'
            : (matchPace < 100.5 ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: !!(databallrA?.ortg && databallrB?.ortg),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS E PARSERS (Tipagem Reforçada)
// ─────────────────────────────────────────────────────────────────────────────

export const getMomentumScore = (record: GameResult[]): number => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null ? (res as { result: string }).result : res;
        return score + (rStr === 'V' ? Math.pow(2, idx) : 0);
    }, 0);
};

export const parseStreakToRecord = (streakStr: string): GameResult[] | null => {
    if (!streakStr) return null;
    const match = streakStr.match(/([WLVD])(\d+)/i);
    if (match) {
        const type = match[1].toUpperCase();
        const count = Math.min(parseInt(match[2], 10), 5);
        const winChar = (type === 'W' || type === 'V') ? 'V' : 'D';
        const lossChar = winChar === 'V' ? 'D' : 'V';
        const record: GameResult[] = new Array(5).fill(lossChar);
        for (let i = 0; i < count; i++) record[4 - i] = winChar;
        return record;
    }
    const chars = streakStr.match(/[VDWL]/g);
    if (chars && chars.length > 0) {
        let results = chars.map(c => (c === 'W' || c === 'V' ? 'V' : 'D')) as GameResult[];
        if (results.length > 5) results = results.slice(-5);
        while (results.length < 5) results.unshift(results[0] === 'V' ? 'D' : 'V');
        return results;
    }
    return null;
};

export const getFormattedDate = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

export const getPlayerWeight = (pts: number): number => Math.floor((pts || 0) / 3);

export const findTeamByName = (name: string, teams: Team[]): Team | null => {
    if (!name) return null;
    const cleanSearch = normalizeTeamName(name);
    return teams.find(t => {
        const teamClean = normalizeTeamName(t.name);
        return teamClean === cleanSearch || teamClean.includes(cleanSearch) || cleanSearch.includes(teamClean);
    }) || null;
};

export const getStandardTeamName = (name: string): string => {
    if (!name) return '';
    const n = name.trim();
    if (n === 'LA Clippers') return 'Los Angeles Clippers';
    return n;
};

export const normalizeTeamName = (name: string): string => {
    if (!name) return '';
    const standard = getStandardTeamName(name);
    return standard.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

export const checkB2B = (teamName: string, dateStr: string, dbPredictions: Array<{ home_team: string; away_team: string; date: string }>) => {
    if (!dbPredictions || !teamName) return { yesterday: false, tomorrow: false };
    const [d, m, y] = dateStr.split('/');
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];

    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];

    const playedYesterday = dbPredictions.some(p =>
        (p.home_team.toLowerCase().includes(teamName.toLowerCase()) ||
            p.away_team.toLowerCase().includes(teamName.toLowerCase())) &&
        p.date === yStr
    );

    const playsTomorrow = dbPredictions.some(p =>
        (p.home_team.toLowerCase().includes(teamName.toLowerCase()) ||
            p.away_team.toLowerCase().includes(teamName.toLowerCase())) &&
        p.date === tStr
    );
    return { yesterday: playedYesterday, tomorrow: playsTomorrow };
};

export const calculateUnderdogValue = (
    teamA: Team,
    teamB: Team,
    analysis: { deltaA: number; deltaB: number; totalPayload: number },
    marketSpread: number | null
) => {
    if (marketSpread === null) return null;
    const rules: string[] = [];
    const isUnderdogA = marketSpread > 0;
    const fairSpread = analysis.deltaB - analysis.deltaA;
    const edge = marketSpread - fairSpread;

    if (isUnderdogA) rules.push('Underdog_Casa');
    const defA = teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 115;
    if (defA < 109.5) rules.push('Defesa_Forte');
    if (analysis.totalPayload < 210) rules.push('Total_Baixo');
    if (Math.abs(edge) >= 4.5) rules.push('Value_Bet');

    return {
        hasValue: rules.length >= 2,
        rules,
        edge: edge.toFixed(1),
        levels: { home: 0, away: 0 },
        kelly: 0
    };
};

export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0], 5);
    const pts2 = parseInt(parts[1], 5);
    if (isNaN(pts1) || isNaN(pts2)) return 0;
    return pts1 + pts2;
};

export const calculateMatchupPaceV2 = (teamA: Team, teamB: Team) => {
    const PACE_FACTOR = SEASON_25_26_METRICS.AVG_ORTG / 100;
    const getGamePace = (score: string) => parseScoreToTotal(score) / (2 * PACE_FACTOR);

    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0
        ? last5A.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5A.length
        : 0;

    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0
        ? last5B.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5B.length
        : 0;

    const normB = normalizeTeamName(teamB.name);
    const h2hGames = (teamA.record || []).filter(g =>
        g.opponent && normalizeTeamName(g.opponent).includes(normB)
    ).slice(-2);

    let avgPaceH2H = 0;
    const hasH2H = h2hGames.length > 0;

    if (hasH2H) {
        avgPaceH2H = h2hGames.reduce((sum, g) => sum + getGamePace(g.score), 0) / h2hGames.length;
    } else if (avgPace5A > 0 && avgPace5B > 0) {
        avgPaceH2H = (avgPace5A + avgPace5B) / 2;
    }

    let finalPace = 0;
    if (avgPace5A > 0 && avgPace5B > 0 && avgPaceH2H > 0) {
        finalPace = (avgPace5A + avgPace5B + avgPaceH2H) / 3;
    }

    return { matchPace: finalPace, avgPace5A, avgPace5B, avgPaceH2H, hasH2H };
};

