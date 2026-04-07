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
    POWER_DIFF_WEIGHT: 0.85,
    DEF_FILTER_FAVORITE_MULT: 2.5,
    DEF_FILTER_UNDERDOG_MULT: 1.4,
    ATK_FILTER_MULT: 0.75, // Ajustado para evitar double-counting
    HOME_ADVANTAGE: 1.75,
    LAST_MARGIN_THRESHOLD: 22,
    LAST_MARGIN_PENALTY: 1.5,
    SCORE_FLOOR_MIN: 92,
    SCORE_CEILING_MAX: 148,
    PACE_ADJUSTMENT_FACTOR: 0.03,
    PACE_THRESHOLD_SLOW: 97.5
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE BLEND DINÂMICO
// ─────────────────────────────────────────────────────────────────────────────
const getDynamicBlendWeights = (recentRtg: number, seasonRtg: number) => {
    const divergence = Math.abs(recentRtg - seasonRtg);
    if (divergence > 12) return { recentW: 0.50, seasonW: 0.50 };
    if (divergence > 8) return { recentW: 0.60, seasonW: 0.40 };
    if (divergence > 5) return { recentW: 0.70, seasonW: 0.30 };
    return { recentW: 0.80, seasonW: 0.20 };
};

const getFallbackPace = (team: Team): number => {
    const offRtg = team.espnData?.pts || team.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG;
    return offRtg / (SEASON_25_26_METRICS.AVG_ORTG / 100);
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    const recentPace = databallr?.pace;
    if (recentPace && recentPace > 0) return recentPace;
    return SEASON_25_26_METRICS.AVG_PACE;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSISTEMA DE PACE (v4.5 - Defensive Control)
// ─────────────────────────────────────────────────────────────────────────────
export const calculateDeterministicPace = (
    teamA: Team,
    teamB: Team,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null,
    injuriesA?: { isOut: boolean; weight: number }[],
    injuriesB?: { isOut: boolean; weight: number }[],
    rtgA?: { defRtg: number },
    rtgB?: { defRtg: number }
): number => {
    const blendedPaceA = getBlendedPace(teamA, databallrA);
    const blendedPaceB = getBlendedPace(teamB, databallrB);

    let projectedPace: number;

    if (rtgA && rtgB) {
        const defDelta = rtgB.defRtg - rtgA.defRtg; 
        const controlFactor = Math.min(0.25, Math.abs(defDelta) / 50); 
        
        if (defDelta > 0) {
            projectedPace = (blendedPaceA * (0.5 + controlFactor)) + (blendedPaceB * (0.5 - controlFactor));
        } else {
            projectedPace = (blendedPaceA * (0.5 - controlFactor)) + (blendedPaceB * (0.5 + controlFactor));
        }
    } else {
        projectedPace = (blendedPaceA + blendedPaceB) / 2;
    }

    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || []).filter(i => i.isOut && i.weight >= 7).reduce((sum) => sum + 0.05, 0);

    projectedPace -= injuryPaceReduction(injuriesA);
    projectedPace -= injuryPaceReduction(injuriesB);

    return projectedPace;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS E PENALIDADES
// ─────────────────────────────────────────────────────────────────────────────
const calculatePenalty = (injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]): number => {
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
// KERNEL DE PROJEÇÃO (v4.5)
// ─────────────────────────────────────────────────────────────────────────────

const applyContextualAdjustments = (scoreA: number, scoreB: number, matchPace: number, options?: PaceOptions) => {
    let adjA = scoreA;
    let adjB = scoreB;

    if (options?.isB2BA) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.isB2BB) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;

    if (options?.lastMarginA && options.lastMarginA > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginB && options.lastMarginB > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;

    if (matchPace < PROJECTION_CONFIG.PACE_THRESHOLD_SLOW) {
        const spread = adjA - adjB;
        const adjustment = spread * PROJECTION_CONFIG.PACE_ADJUSTMENT_FACTOR;
        adjA -= adjustment;
        adjB += adjustment;
    }

    return { adjA, adjB };
};

const applyTeamSuperiority = (targetScore: number, opponentScore: number, targetRtg: { offRtg: number; defRtg: number }, opponentRtg: { offRtg: number; defRtg: number }, isFavorite: boolean) => {
    let adjTarget = targetScore;
    let adjOpponent = opponentScore;

    if (targetRtg.defRtg < opponentRtg.defRtg) {
        const mult = isFavorite ? PROJECTION_CONFIG.DEF_FILTER_FAVORITE_MULT : PROJECTION_CONFIG.DEF_FILTER_UNDERDOG_MULT;
        adjOpponent -= (opponentRtg.defRtg - targetRtg.defRtg) * mult;
    }

    if (targetRtg.offRtg > opponentRtg.offRtg) {
        adjTarget += (targetRtg.offRtg - opponentRtg.offRtg) * PROJECTION_CONFIG.ATK_FILTER_MULT;
    }

    return { adjTarget, adjOpponent };
};

const applySuperiorityFilters = (scoreA: number, scoreB: number, teamA: Team, teamB: Team, rtgA: { offRtg: number; defRtg: number }, rtgB: { offRtg: number; defRtg: number }, powerA: number, powerB: number) => {
    let adjA = scoreA;
    let adjB = scoreB;
    const powerDiff = powerA - powerB;

    if (powerA > powerB) {
        adjA += powerDiff * PROJECTION_CONFIG.POWER_DIFF_WEIGHT;
        const { adjTarget, adjOpponent } = applyTeamSuperiority(adjA, adjB, rtgA, rtgB, true);
        adjA = adjTarget; adjB = adjOpponent;
    } else if (powerB > powerA) {
        adjB += Math.abs(powerDiff) * PROJECTION_CONFIG.POWER_DIFF_WEIGHT;
        const { adjTarget, adjOpponent } = applyTeamSuperiority(adjB, adjA, rtgB, rtgA, false);
        adjB = adjTarget; adjA = adjOpponent;
    }
    return { adjA, adjB };
};

const applyVolatilityFilter = (scoreA: number, scoreB: number, databallrA?: DataballrInput | null, databallrB?: DataballrInput | null, powerA: number = 0, powerB: number = 0) => {
    let adjA = scoreA;
    let adjB = scoreB;
    const netA = databallrA?.net_rating ?? NaN;
    const netB = databallrB?.net_rating ?? NaN;
    if (powerA > 0 && powerB > 0 && powerA <= 3.5 && powerB <= 3.5 && !isNaN(Number(netA)) && !isNaN(Number(netB))) {
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
        options?.injuriesA, options?.injuriesB,
        rtgA, rtgB
    );

    let projA = ((rtgA.offRtg + rtgB.defRtg) / 2) * (matchPace / 100);
    let projB = ((rtgB.offRtg + rtgA.defRtg) / 2) * (matchPace / 100);

    const context = applyContextualAdjustments(projA, projB, matchPace, options);
    projA = context.adjA; projB = context.adjB;

    const superiority = applySuperiorityFilters(projA, projB, teamA, teamB, rtgA, rtgB, options?.aiScoreA ?? 0, options?.aiScoreB ?? 0);
    projA = superiority.adjA; projB = superiority.adjB;

    const volatility = applyVolatilityFilter(projA, projB, databallrA, databallrB, options?.aiScoreA, options?.aiScoreB);
    projA = volatility.adjA; projB = volatility.adjB;

    const homeAdv = PROJECTION_CONFIG.HOME_ADVANTAGE;
    if (options?.isHomeA) { projA += homeAdv; projB -= homeAdv; } 
    else { projB += homeAdv; projA -= homeAdv; }

    projA -= calculatePenalty(options?.injuriesA);
    projB -= calculatePenalty(options?.injuriesB);

    const { finalA, finalB } = clampScores(projA, projB, rtgA.seasonPPG - 30, rtgB.seasonPPG - 30);

    return {
        matchPace,
        totalPayload: finalA + finalB,
        deltaA: finalA,
        deltaB: finalB,
        kineticState: matchPace > 105.5 ? 'HYPER_KINETIC' : (matchPace < 100.5 ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: !!(databallrA?.ortg && databallrB?.ortg),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

export const getMomentumScore = (record: GameResult[]): number => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null ? (res as { result: string }).result : res;
        return score + (rStr === 'V' ? Math.pow(2, idx) : 0);
    }, 0);
};

export const normalizeTeamName = (name: string): string => {
    if (!name) return '';
    return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
