import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean | undefined;
    isB2BA?: boolean | undefined;
    isB2BB?: boolean | undefined;
    lastMarginA?: number | undefined;
    lastMarginB?: number | undefined;
    powerA?: number | undefined;
    powerB?: number | undefined;
    editorInsight?: string | undefined;
    seriesScore?: string | undefined;
}

export interface DataballrInput {
    ortg?: number | undefined;
    drtg?: number | undefined;
    pace?: number | null | undefined;
    o_ts?: number | undefined;
    o_tov?: number | undefined;
    orb?: number | undefined;
    drb?: number | undefined;
    net_rating?: number | undefined;
    offense_rating?: number | undefined;
    defense_rating?: number | undefined;
    net_poss?: number | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD DE CONFIGURAÇÃO - KERNEL V5.4 (Blowout Detection + Momentum 3x)
// ─────────────────────────────────────────────────────────────────────────────
const SEASON_25_26_METRICS = {
    AVG_ORTG: 115.5,
    AVG_PACE: 99.3,
    AVG_TOV: 14.8,
    AVG_TS: 58.8,
    MIN_PACE: 95.0,
    MAX_PACE: 103.0,
    PLAYOFF_MAX_PACE: 102.5,
    PLAYOFF_SCORE_CEILING_MAX: 124.0,
    AVG_ORB: 23.5
} as const;

const PROJECTION_CONFIG = {
    POWER_DIFF_WEIGHT: 1.1,
    DEF_FILTER_FAVORITE_MULT: 1.2,
    DEF_FILTER_UNDERDOG_MULT: 1.0,
    ATK_FILTER_MULT: 0.75,
    HOME_ADVANTAGE: 1.80,
    LAST_MARGIN_THRESHOLD: 22,
    LAST_MARGIN_PENALTY: 1.5,
    SCORE_FLOOR_MIN: 92,
    SCORE_CEILING_MAX: 130,
    PACE_ADJUSTMENT_FACTOR: 0.03,
    PACE_THRESHOLD_SLOW: 97.5,
    OVERCLOCK_THRESHOLD: 2.0,
    OVERCLOCK_BOOST: 1.04,
    // Elimination Game Psychology
    ELIMINATION_UNDERDOG_BOOST: 1.025,
    ELIMINATION_FAVORITE_NERF: 0.975,
    // Close Series Boost
    CLOSE_SERIES_HOME_BOOST: 1.03,
    CLOSE_SERIES_AWAY_NERF: 0.97,
    // Bench Depth Penalty
    BENCH_DEPTH_PENALTY_PER_PLAYER: 1.5,
    BENCH_DEPTH_THRESHOLD: 2,
    // [V5.4] Momentum Playoff Multiplier aumentado para 3x
    MOMENTUM_PLAYOFF_MULTIPLIER: 3.0,
    MOMENTUM_BASE_IMPACT: 0.3,
    // Calibração Lesão
    STAR_INJURY_MAX_IMPACT: 15.0,
    STAR_INJURY_HW_MULTIPLIER: 1.3,
    SYSTEMIC_COLLAPSE_PENALTY: 0.90,
    // [V5.4] Floor DTD de estrela
    FLOOR_STAR_DTD_MULTIPLIER: 0.88,
    FLOOR_STAR_OUT_MULTIPLIER: 0.82,
    FLOOR_MULTIPLE_OUT_MULTIPLIER: 0.88,
    FLOOR_DEFAULT_MULTIPLIER: 0.92,
    // [V5.4] Blowout Detection
    BLOWOUT_MARGIN_THRESHOLD: 15,
    BLOWOUT_BOOST_WINNER: 1.04,  // +4% para vencedor do blowout
    BLOWOUT_NERF_LOSER: 0.96,    // -4% para perdedor do blowout
    BLOWOUT_H2H_LOOKBACK: 3,     // Últimos 3 jogos H2H
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────
const getFallbackPace = (): number => SEASON_25_26_METRICS.AVG_PACE;

const getTeamRatings = (entity: Team, databallr?: DataballrInput | null) => {
    const ppg = Number(entity.espnData?.pts || entity.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG);
    const def = Number(entity.espnData?.pts_contra || entity.stats?.media_pontos_defesa || SEASON_25_26_METRICS.AVG_ORTG);
    const pace = Number(entity.espnData?.pace) || getFallbackPace();
    return {
        offRtg: databallr?.ortg || (ppg / pace) * 100,
        defRtg: databallr?.drtg || (def / pace) * 100,
        seasonPPG: ppg,
        pace
    };
};

// [V5.4] Momentum com multiplicador 3x em playoffs
const calculateMomentumImpact = (record: any[], isPlayoff: boolean = false): number => {
    const momentumScore = record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null && 'result' in res ? (res as any).result : res;
        return score + (rStr === 'V' ? Math.pow(2, idx) : 0);
    }, 0);
    const normalizedMomentum = (momentumScore - 15) / 3;
    const multiplier = isPlayoff ? PROJECTION_CONFIG.MOMENTUM_PLAYOFF_MULTIPLIER : 1.0;
    return normalizedMomentum * PROJECTION_CONFIG.MOMENTUM_BASE_IMPACT * multiplier;
};

// [V5.4] Blowout Detection - verifica H2H recente
const detectBlowoutTrend = (h2hGames?: any[]): { hasBlowout: boolean; winner: 'A' | 'B' | null; margin: number } => {
    if (!h2hGames || h2hGames.length === 0) return { hasBlowout: false, winner: null, margin: 0 };

    const recentGames = h2hGames.slice(-PROJECTION_CONFIG.BLOWOUT_H2H_LOOKBACK);
    let blowoutCount = 0;
    let blowoutWinner: 'A' | 'B' | null = null;
    let maxMargin = 0;

    recentGames.forEach((game: any) => {
        const score = game.score;
        if (!score) return;
        const parts = score.split(/[-\s:]+/);
        if (parts.length < 2) return;
        const ptsA = parseInt(parts[0]);
        const ptsB = parseInt(parts[1]);
        const margin = Math.abs(ptsA - ptsB);

        if (margin >= PROJECTION_CONFIG.BLOWOUT_MARGIN_THRESHOLD) {
            blowoutCount++;
            if (margin > maxMargin) {
                maxMargin = margin;
                blowoutWinner = ptsA > ptsB ? 'A' : 'B';
            }
        }
    });

    // Se 2+ blowouts nos últimos 3 jogos, é tendência
    return {
        hasBlowout: blowoutCount >= 2,
        winner: blowoutCount >= 2 ? blowoutWinner : null,
        margin: maxMargin
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSISTEMA DE PACE
// ─────────────────────────────────────────────────────────────────────────────
export const calculateDeterministicPace = (
    teamA: Team, teamB: Team,
    databallrA?: DataballrInput | null, databallrB?: DataballrInput | null,
    injuriesA?: { isOut: boolean; weight: number }[], injuriesB?: { isOut: boolean; weight: number }[],
    rtgA?: { defRtg: number }, rtgB?: { defRtg: number },
    powerA: number = 0, powerB: number = 0,
    h2hFromDefense?: any[], isPlayoff: boolean = false, editorInsight?: string
): number => {
    const PACE_FACTOR = SEASON_25_26_METRICS.AVG_ORTG / 100;
    const currentMaxPace = isPlayoff ? SEASON_25_26_METRICS.PLAYOFF_MAX_PACE : SEASON_25_26_METRICS.MAX_PACE;

    const getGamePaceClamped = (score: string) => {
        const rawPace = parseScoreToTotal(score) / (2 * PACE_FACTOR);
        return Math.min(rawPace, 103.0);
    };

    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0 ? last5A.reduce((sum, g) => {
        const score = typeof g === 'object' && g !== null && 'score' in g ? (g as any).score : null;
        return sum + (score ? getGamePaceClamped(score) : getFallbackPace());
    }, 0) / last5A.length : getFallbackPace();

    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0 ? last5B.reduce((sum, g) => {
        const score = typeof g === 'object' && g !== null && 'score' in g ? (g as any).score : null;
        return sum + (score ? getGamePaceClamped(score) : getFallbackPace());
    }, 0) / last5B.length : getFallbackPace();

    const mediaL5 = (avgPace5A + avgPace5B) / 2;

    let avgPaceH2H = 0;
    const h2hGames = h2hFromDefense && h2hFromDefense.length > 0 ? h2hFromDefense : [];
    if (h2hGames.length > 0) {
        avgPaceH2H = h2hGames.reduce((sum, g) => sum + (parseScoreToTotal(g.score) / (2 * PACE_FACTOR)), 0) / h2hGames.length;
    }

    let basePace = avgPaceH2H > 0 ? (mediaL5 * 0.50) + (avgPaceH2H * 0.50) : mediaL5;

    const powerDiff = Math.abs(powerA - powerB);
    const strongestTeamPace = powerA >= powerB ? (databallrA?.pace || avgPace5A) : (databallrB?.pace || avgPace5B);
    const bestDefenderPace = (rtgA && rtgB && rtgA.defRtg < rtgB.defRtg) ? (databallrA?.pace || avgPace5A) : (databallrB?.pace || avgPace5B);

    const forceWeight = isPlayoff ? 0.60 : 0.80;
    const attrWeight = 1 - forceWeight;
    basePace = (basePace * 0.5) + ((strongestTeamPace * forceWeight + bestDefenderPace * attrWeight) * 0.5);

    let projectedPace = Math.min(basePace, currentMaxPace);

    const hasOverclockKeyword = editorInsight?.match(/OVERCLOCK/i);
    if (!isPlayoff && (powerDiff >= PROJECTION_CONFIG.OVERCLOCK_THRESHOLD || hasOverclockKeyword)) {
        projectedPace *= PROJECTION_CONFIG.OVERCLOCK_BOOST;
        if (hasOverclockKeyword && process.env.NODE_ENV === 'development') {
            console.log('[SYS-OP] OVERCLOCK disparado por gatilho editorial (+4%).');
        }
    }

    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || []).filter(i => i.isOut && i.weight >= 7).reduce((sum, _) => sum + 0.05, 0);
    projectedPace -= (injuryPaceReduction(injuriesA) + injuryPaceReduction(injuriesB));

    return projectedPace;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS E PENALIDADES
// ─────────────────────────────────────────────────────────────────────────────
const calculatePenalty = (injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]): number => {
    let p = 0;
    (injuries || []).forEach(inj => {
        if (inj.isOut) p += inj.weight >= 9 ? (inj.weight * 1.5) + 1 : inj.weight;
        else if (inj.isDayToDay) p += inj.weight * 0.05;
    });
    return p;
};

const calculateStarInjuryImpactV2 = (injuries?: { isOut: boolean; weight: number }[]): number => {
    const starOut = (injuries || []).filter(i => i.isOut && i.weight >= 9);
    return starOut.reduce((total, star) => {
        const impact = Math.min(star.weight * PROJECTION_CONFIG.STAR_INJURY_HW_MULTIPLIER, PROJECTION_CONFIG.STAR_INJURY_MAX_IMPACT);
        return total + impact;
    }, 0);
};

const applySystemicCollapseV2 = (score: number, injuries?: { isOut: boolean; weight: number }[]): number => {
    const hasCriticalOut = (injuries || []).some(i => i.isOut && i.weight >= 9);
    if (hasCriticalOut) return score * PROJECTION_CONFIG.SYSTEMIC_COLLAPSE_PENALTY;
    return score;
};

// [V5.4] Floor dinâmico com DTD de estrela
const getDynamicFloor = (seasonPPG: number, injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]): number => {
    const hasStarOut = (injuries || []).some(i => i.isOut && i.weight >= 9);
    const hasStarDTD = (injuries || []).some(i => i.isDayToDay && i.weight >= 8);
    const outCount = (injuries || []).filter(i => i.isOut).length;

    if (hasStarOut) return seasonPPG * PROJECTION_CONFIG.FLOOR_STAR_OUT_MULTIPLIER;
    if (hasStarDTD) return seasonPPG * PROJECTION_CONFIG.FLOOR_STAR_DTD_MULTIPLIER; // [NOVO] 0.88x
    if (outCount >= PROJECTION_CONFIG.BENCH_DEPTH_THRESHOLD) return seasonPPG * PROJECTION_CONFIG.FLOOR_MULTIPLE_OUT_MULTIPLIER;
    return seasonPPG * PROJECTION_CONFIG.FLOOR_DEFAULT_MULTIPLIER;
};

const calculateBenchDepthPenalty = (injuries?: { isOut: boolean; weight: number }[]): number => {
    const outPlayers = (injuries || []).filter(i => i.isOut);
    if (outPlayers.length >= PROJECTION_CONFIG.BENCH_DEPTH_THRESHOLD) {
        return (outPlayers.length - PROJECTION_CONFIG.BENCH_DEPTH_THRESHOLD + 1) * PROJECTION_CONFIG.BENCH_DEPTH_PENALTY_PER_PLAYER;
    }
    return 0;
};

export const calculateStarUncertainty = (injuries?: { nome?: string; isOut: boolean; isDayToDay?: boolean; weight: number }[]): { variance: number; note: string; playerName?: string } => {
    const starDTD = (injuries || []).find(i => i.isDayToDay && i.weight >= 8);
    if (starDTD) {
        return { variance: 6.0, note: `${starDTD.nome || 'Star'} DTD (HW ${starDTD.weight}) - high variance game`, playerName: starDTD.nome };
    }
    return { variance: 0, note: '' };
};

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL DE PROJEÇÃO
// ─────────────────────────────────────────────────────────────────────────────
const applyContextualAdjustments = (scoreA: number, scoreB: number, matchPace: number, options?: PaceOptions) => {
    let adjA = scoreA, adjB = scoreB;
    if (options?.isB2BA) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.isB2BB) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginA && options.lastMarginA > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginB && options.lastMarginB > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;

    if (options?.editorInsight) {
        if (options.editorInsight.match(/🎯 NOSSA APOSTA:\s*OVER/i)) {
            adjA += 2.5; adjB += 2.5;
        }
        if (options.editorInsight.match(/RUPTURA OFFENSIVA/i)) {
            adjA *= 1.02; adjB *= 1.02;
        }
    }
    return { adjA, adjB };
};

const applySuperiorityFilters = (scoreA: number, scoreB: number, teamA: Team, teamB: Team, rtgA: any, rtgB: any, powerA: number, powerB: number, isPlayoff: boolean = false) => {
    let adjA = scoreA, adjB = scoreB;
    const powerDiff = Math.abs(powerA - powerB);
    const offDiff = Math.abs(rtgA.offRtg - rtgB.offRtg);
    const defDiff = Math.abs(rtgA.defRtg - rtgB.defRtg);

    const isDogfight = powerDiff < 1.5 && offDiff < 5.0 && defDiff < 5.0;
    const combinedOffense = (rtgA.offRtg + rtgB.offRtg) / 2;
    const isShootout = combinedOffense >= 119.0 && rtgA.offRtg >= 112.0 && rtgB.offRtg >= 112.0;
    const combinedDefense = (rtgA.defRtg + rtgB.defRtg) / 2;
    const isDefensiveCollapse = combinedDefense >= 116.5 && rtgA.defRtg >= 114.0 && rtgB.defRtg >= 114.0;

    let baseAtkMult = isPlayoff ? PROJECTION_CONFIG.ATK_FILTER_MULT * 0.65 : PROJECTION_CONFIG.ATK_FILTER_MULT;
    const currentAtkMult = (isDogfight && !isShootout && !isDefensiveCollapse) ? (baseAtkMult * 0.7) : baseAtkMult;
    const DEF_PLAYOFF_NERF = isPlayoff ? 0.6 : 1.0;

    const applyTeamSuperiorityV5 = (targetScore: number, opponentScore: number, targetRtg: any, opponentRtg: any, isFavorite: boolean) => {
        let adjT = targetScore, adjO = opponentScore;
        if (targetRtg.defRtg < opponentRtg.defRtg) {
            const mult = (isFavorite ? PROJECTION_CONFIG.DEF_FILTER_FAVORITE_MULT : PROJECTION_CONFIG.DEF_FILTER_UNDERDOG_MULT) * DEF_PLAYOFF_NERF;
            adjO -= (opponentRtg.defRtg - targetRtg.defRtg) * mult;
        }
        if (targetRtg.offRtg > opponentRtg.offRtg) {
            adjT += (targetRtg.offRtg - opponentRtg.offRtg) * currentAtkMult;
        }
        return { adjT, adjO };
    };

    if (powerA > powerB) {
        adjA += powerDiff * PROJECTION_CONFIG.POWER_DIFF_WEIGHT;
        const { adjT, adjO } = applyTeamSuperiorityV5(adjA, adjB, rtgA, rtgB, true);
        adjA = adjT; adjB = adjO;
    } else if (powerB > powerA) {
        adjB += powerDiff * PROJECTION_CONFIG.POWER_DIFF_WEIGHT;
        const { adjT, adjO } = applyTeamSuperiorityV5(adjB, adjA, rtgB, rtgA, false);
        adjB = adjT; adjA = adjO;
    } else {
        const supA = applyTeamSuperiorityV5(adjA, adjB, rtgA, rtgB, false);
        const supB = applyTeamSuperiorityV5(adjB, adjA, rtgB, rtgA, false);
        adjA = (supA.adjT + supB.adjO) / 2;
        adjB = (supB.adjT + supA.adjO) / 2;
    }

    if (isShootout) {
        const rawBonus = Math.min((combinedOffense - 119.0) * 1.5, 6.0);
        const shootoutBonus = isPlayoff ? rawBonus * 0.5 : rawBonus;
        if (shootoutBonus > 0) { adjA += shootoutBonus; adjB += shootoutBonus; }
    } else if (isDefensiveCollapse) {
        const rawBonus = Math.min((combinedDefense - 116.0) * 1.5, 5.5);
        const collapseBonus = isPlayoff ? rawBonus * 0.5 : rawBonus;
        adjA += collapseBonus; adjB += collapseBonus;
    } else if (isDogfight) {
        adjA -= 1.5; adjB -= 1.5;
    }

    return { adjA, adjB };
};

const applyVolatilityFilter = (scoreA: number, scoreB: number, databallrA?: DataballrInput | null, databallrB?: DataballrInput | null, powerA: number = 0, powerB: number = 0) => {
    let adjA = scoreA, adjB = scoreB;
    const netA = databallrA?.net_rating !== undefined ? databallrA.net_rating : null;
    const netB = databallrB?.net_rating !== undefined ? databallrB.net_rating : null;
    if (netA === null || netB === null) return { adjA, adjB };
    const shouldApply = powerA >= 0 && powerB >= 0 && powerA <= 3.5 && powerB <= 3.5;
    if (shouldApply) {
        if (netB < 0) adjA += Math.min(Math.abs(netB), 4.0);
        if (netA < 0) adjB += Math.min(Math.abs(netA), 4.0);
        if (netA < 0) adjA -= Math.min(Math.abs(netA) * 0.6, 3.0);
        if (netB < 0) adjB -= Math.min(Math.abs(netB) * 0.6, 3.0);
    }
    return { adjA, adjB };
};

const clampScores = (scoreA: number, scoreB: number, floorA: number, floorB: number, isPlayoff: boolean = false) => {
    const ceiling = isPlayoff ? SEASON_25_26_METRICS.PLAYOFF_SCORE_CEILING_MAX : PROJECTION_CONFIG.SCORE_CEILING_MAX;
    return {
        finalA: Math.max(floorA, Math.min(ceiling, scoreA)),
        finalB: Math.max(floorB, Math.min(ceiling, scoreB))
    };
};

const isCloseSeriesGame = (seriesScore?: string, isHomeA?: boolean): { isClose: boolean; leader: 'A' | 'B' | null } => {
    if (!seriesScore) return { isClose: false, leader: null };
    const match = seriesScore.match(/(\d+)-(\d+)/);
    if (!match) return { isClose: false, leader: null };
    const [_, winsA, winsB] = match.map(Number);
    const winsNeeded = 4;
    const canAWinSeries = winsA === winsNeeded - 1;
    const canBWinSeries = winsB === winsNeeded - 1;
    if (canAWinSeries || canBWinSeries) {
        return { isClose: true, leader: winsA > winsB ? 'A' : winsB > winsA ? 'B' : null };
    }
    return { isClose: false, leader: null };
};

export const calculateProjectedScores = (
    teamA: Team, teamB: Team,
    options?: PaceOptions & {
        injuriesA?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
        injuriesB?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
        defenseData?: any[];
    },
    databallrA?: DataballrInput | null, databallrB?: DataballrInput | null
) => {
    const isPlayoff = !!options?.editorInsight?.match(/playoff|pós-temporada|round \d|game \d|série/i);
    const powerDiffWeight = isPlayoff ? 0.95 : PROJECTION_CONFIG.POWER_DIFF_WEIGHT;

    const rtgA = getTeamRatings(teamA, databallrA);
    const rtgB = getTeamRatings(teamB, databallrB);

    const matchPace = calculateDeterministicPace(
        teamA, teamB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB,
        rtgA, rtgB, options?.powerA ?? 0, options?.powerB ?? 0,
        options?.defenseData, isPlayoff, options?.editorInsight
    );

    let projA: number, projB: number;
    const offDiff = Math.abs(rtgA.offRtg - rtgB.offRtg);

    if ((options?.powerA ?? 0) > (options?.powerB ?? 0) + 1.0 && offDiff > 5.0) {
        projA = (rtgA.offRtg * 0.7 + ((rtgA.offRtg + rtgB.defRtg) / 2) * 0.3) * (matchPace / 100);
        projB = ((rtgB.offRtg + rtgA.defRtg) / 2) * (matchPace / 100);
    } else if ((options?.powerB ?? 0) > (options?.powerA ?? 0) + 1.0 && offDiff > 5.0) {
        projA = ((rtgA.offRtg + rtgB.defRtg) / 2) * (matchPace / 100);
        projB = (rtgB.offRtg * 0.7 + ((rtgB.offRtg + rtgA.defRtg) / 2) * 0.3) * (matchPace / 100);
    } else {
        projA = ((rtgA.offRtg + rtgB.defRtg) / 2) * (matchPace / 100);
        projB = ((rtgB.offRtg + rtgA.defRtg) / 2) * (matchPace / 100);
    }

    const context = applyContextualAdjustments(projA, projB, matchPace, options);
    projA = context.adjA; projB = context.adjB;

    const superiority = applySuperiorityFilters(projA, projB, teamA, teamB, rtgA, rtgB, options?.powerA ?? 0, options?.powerB ?? 0, isPlayoff);
    const powerDiff = Math.abs((options?.powerA ?? 0) - (options?.powerB ?? 0));
    const powerAdj = powerDiff * (powerDiffWeight - PROJECTION_CONFIG.POWER_DIFF_WEIGHT);
    if (options?.powerA && options.powerB) {
        if (options.powerA > options.powerB) projA += powerAdj;
        else projB += powerAdj;
    }
    projA = superiority.adjA; projB = superiority.adjB;

    // Elimination Game Psychology
    const isEliminationGame = options?.editorInsight?.match(/elimination|eliminatório|down \d-\d|jogo \d.*série|jogo \d.*encerrar/i);
    if (isEliminationGame && isPlayoff) {
        const isUnderdogA = (options?.powerA ?? 0) < (options?.powerB ?? 0);
        if (isUnderdogA) {
            projA *= PROJECTION_CONFIG.ELIMINATION_UNDERDOG_BOOST;
            projB *= PROJECTION_CONFIG.ELIMINATION_FAVORITE_NERF;
        } else {
            projB *= PROJECTION_CONFIG.ELIMINATION_UNDERDOG_BOOST;
            projA *= PROJECTION_CONFIG.ELIMINATION_FAVORITE_NERF;
        }
    }

    // Close Series
    const closeSeries = isCloseSeriesGame(options?.seriesScore, options?.isHomeA);
    if (closeSeries.isClose && isPlayoff) {
        if (closeSeries.leader === 'A' && options?.isHomeA) {
            projA *= PROJECTION_CONFIG.CLOSE_SERIES_HOME_BOOST;
            projB *= PROJECTION_CONFIG.CLOSE_SERIES_AWAY_NERF;
        } else if (closeSeries.leader === 'B' && !options?.isHomeA) {
            projB *= PROJECTION_CONFIG.CLOSE_SERIES_HOME_BOOST;
            projA *= PROJECTION_CONFIG.CLOSE_SERIES_AWAY_NERF;
        }
    }

    // [V5.4] Blowout Detection
    const blowoutTrend = detectBlowoutTrend(options?.defenseData);
    if (blowoutTrend.hasBlowout && isPlayoff) {
        if (blowoutTrend.winner === 'A') {
            projA *= PROJECTION_CONFIG.BLOWOUT_BOOST_WINNER;
            projB *= PROJECTION_CONFIG.BLOWOUT_NERF_LOSER;
            if (process.env.NODE_ENV === 'development') console.log(`[SYS-OP] BLOWOUT TREND: Team A winner (+4%), Team B loser (-4%)`);
        } else if (blowoutTrend.winner === 'B') {
            projB *= PROJECTION_CONFIG.BLOWOUT_BOOST_WINNER;
            projA *= PROJECTION_CONFIG.BLOWOUT_NERF_LOSER;
            if (process.env.NODE_ENV === 'development') console.log(`[SYS-OP] BLOWOUT TREND: Team B winner (+4%), Team A loser (-4%)`);
        }
    }

    // [V5.4] Momentum Playoff com 3x
    if (isPlayoff) {
        const momentumA = calculateMomentumImpact(teamA.record || [], true);
        const momentumB = calculateMomentumImpact(teamB.record || [], true);
        projA += momentumA;
        projB += momentumB;
    }

    const volatility = applyVolatilityFilter(projA, projB, databallrA, databallrB, options?.powerA, options?.powerB);
    projA = volatility.adjA; projB = volatility.adjB;

    const homeAdv = PROJECTION_CONFIG.HOME_ADVANTAGE;
    if (options?.isHomeA) { projA += homeAdv; projB -= homeAdv; }
    else { projB += homeAdv; projA -= homeAdv; }

    // Lesões calibradas
    projA -= (calculatePenalty(options?.injuriesA) + calculateStarInjuryImpactV2(options?.injuriesA));
    projB -= (calculatePenalty(options?.injuriesB) + calculateStarInjuryImpactV2(options?.injuriesB));

    const benchPenaltyA = calculateBenchDepthPenalty(options?.injuriesA);
    const benchPenaltyB = calculateBenchDepthPenalty(options?.injuriesB);
    projA -= benchPenaltyA;
    projB -= benchPenaltyB;

    projA = applySystemicCollapseV2(projA, options?.injuriesA);
    projB = applySystemicCollapseV2(projB, options?.injuriesB);

    // Floor dinâmico V5.4
    const floorA = getDynamicFloor(rtgA.seasonPPG, options?.injuriesA);
    const floorB = getDynamicFloor(rtgB.seasonPPG, options?.injuriesB);

    const { finalA, finalB } = clampScores(projA, projB, floorA, floorB, isPlayoff);

    let totalPayload = finalA + finalB;
    const kineticState = matchPace > 105.5 ? 'HYPER_KINETIC' : (matchPace < 97.5 ? 'SLOW_GRIND' : 'STATIC_TRENCH');

    if (isPlayoff && (kineticState === 'STATIC_TRENCH' || kineticState === 'SLOW_GRIND')) {
        totalPayload *= 0.91;
    }

    const uncertaintyA = calculateStarUncertainty(options?.injuriesA);
    const uncertaintyB = calculateStarUncertainty(options?.injuriesB);

    return {
        matchPace, totalPayload, deltaA: finalA, deltaB: finalB, kineticState,
        databallrEnhanced: !!(databallrA?.ortg && databallrB?.ortg), isPlayoff, confidenceModifier: 0,
        uncertaintyVariance: Math.max(uncertaintyA.variance, uncertaintyB.variance),
        uncertaintyNote: uncertaintyA.note || uncertaintyB.note || '',
        isCloseSeries: closeSeries.isClose, seriesLeader: closeSeries.leader,
        benchPenaltyA, benchPenaltyB,
        momentumA: isPlayoff ? calculateMomentumImpact(teamA.record || [], true) : 0,
        momentumB: isPlayoff ? calculateMomentumImpact(teamB.record || [], true) : 0,
        floorA, floorB,
        starPenaltyA: calculateStarInjuryImpactV2(options?.injuriesA),
        starPenaltyB: calculateStarInjuryImpactV2(options?.injuriesB),
        blowoutDetected: blowoutTrend.hasBlowout,
        blowoutWinner: blowoutTrend.winner,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────
export const getMomentumScore = (record: any[]): number => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null && 'result' in res ? (res as any).result : res;
        return score + (rStr === 'V' ? Math.pow(2, idx) : 0);
    }, 0);
};

export const parseStreakToRecord = (streakStr: string): GameResult[] | null => {
    if (!streakStr) return null;
    const match = streakStr.match(/([WLVD])(\d+)/i);
    if (match && match[1] && match[2]) {
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
        while (results.length < 5) {
            const first = results[0];
            if (first) results.unshift(first === 'V' ? 'D' : 'V');
            else break;
        }
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

export const getStandardTeamName = (name: string): string => {
    if (!name) return '';
    const n = name.trim();
    if (n === 'LA Clippers') return 'Los Angeles Clippers';
    return n;
};

export const normalizeTeamName = (name: string): string => {
    if (!name) return '';
    return getStandardTeamName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

export const findTeamByName = (name: string, teams: Team[]): Team | null => {
    if (!name) return null;
    const cleanSearch = normalizeTeamName(name);
    return teams.find(t => {
        const teamClean = normalizeTeamName(t.name);
        return teamClean === cleanSearch || teamClean.includes(cleanSearch) || cleanSearch.includes(teamClean);
    }) || null;
};

export const checkB2B = (teamName: string, dateStr: string, dbPredictions: Array<{ home_team: string; away_team: string; date: string }>) => {
    if (!dbPredictions || !teamName) return { yesterday: false, tomorrow: false };
    const [d, m, y] = dateStr.split('/');
    if (!d || !m || !y) return { yesterday: false, tomorrow: false };
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const formatDateLocal = (date: Date) => {
        const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    const yesterday = new Date(current); yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(current); tomorrow.setDate(tomorrow.getDate() + 1);
    const yStr = formatDateLocal(yesterday), tStr = formatDateLocal(tomorrow);
    const playedYesterday = dbPredictions.some(p => (p.home_team.toLowerCase().includes(teamName.toLowerCase()) || p.away_team.toLowerCase().includes(teamName.toLowerCase())) && p.date === yStr);
    const playsTomorrow = dbPredictions.some(p => (p.home_team.toLowerCase().includes(teamName.toLowerCase()) || p.away_team.toLowerCase().includes(teamName.toLowerCase())) && p.date === tStr);
    return { yesterday: playedYesterday, tomorrow: playsTomorrow };
};

export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0] || '0', 10), pts2 = parseInt(parts[1] || '0', 10);
    return isNaN(pts1) || isNaN(pts2) ? 0 : pts1 + pts2;
};

export const calculateMatchupPaceV2 = (teamA: Team, teamB: Team, h2hFromDefense?: any[]) => {
    const PACE_FACTOR = SEASON_25_26_METRICS.AVG_ORTG / 100;
    const getGamePace = (score: string) => parseScoreToTotal(score) / (2 * PACE_FACTOR);
    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0 ? last5A.reduce((sum, g) => {
        const score = typeof g === 'object' && g !== null && 'score' in g ? (g as any).score : null;
        return sum + (score ? getGamePace(score) : 0);
    }, 0) / last5A.length : 0;
    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0 ? last5B.reduce((sum, g) => {
        const score = typeof g === 'object' && g !== null && 'score' in g ? (g as any).score : null;
        return sum + (score ? getGamePace(score) : 0);
    }, 0) / last5B.length : 0;
    const normB = normalizeTeamName(teamB.name);
    let h2hGames = h2hFromDefense && h2hFromDefense.length > 0 ? h2hFromDefense : [];
    if (h2hGames.length === 0) {
        h2hGames = (teamA.record || []).filter(g => {
            const opp = typeof g === 'object' && g !== null && 'opponent' in g ? (g as any).opponent : null;
            return opp && normalizeTeamName(opp).includes(normB);
        }).slice(-2);
    }
    let avgPaceH2H = 0;
    if (h2hGames.length > 0) {
        avgPaceH2H = h2hGames.reduce((sum, g) => {
            const score = typeof g === 'object' && g !== null && 'score' in g ? (g as any).score : null;
            return sum + (score ? getGamePace(score) : 0);
        }, 0) / h2hGames.length;
    } else if (avgPace5A > 0 && avgPace5B > 0) avgPaceH2H = (avgPace5A + avgPace5B) / 2;
    let finalPace = 0;
    if (avgPace5A > 0 && avgPace5B > 0 && avgPaceH2H > 0) finalPace = (avgPace5A + avgPace5B + avgPaceH2H) / 3;
    return { matchPace: finalPace, avgPace5A, avgPace5B, avgPaceH2H, hasH2H: h2hGames.length > 0 };
};

export const calculateUnderdogValue = (teamA: Team, teamB: Team, analysis: { deltaA: number; deltaB: number; totalPayload: number }, marketSpread: number | null) => {
    if (marketSpread === null) return null;
    const rules: string[] = [];
    const isUnderdogA = marketSpread > 0;
    const fairSpread = analysis.deltaB - analysis.deltaA;
    const edge = marketSpread - fairSpread;
    if (isUnderdogA) rules.push('Underdog_Casa');
    const defA = Number(teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 115);
    if (defA < 109.5) rules.push('Defesa_Forte');
    if (analysis.totalPayload < 210) rules.push('Total_Baixo');
    if (Math.abs(edge) >= 4.5) rules.push('Value_Bet');
    const kellyValue = Math.max(0, (edge * 1.5) / 100);
    return {
        hasValue: rules.length >= 2, rules, edge: Number(edge).toFixed(1),
        levels: {
            home: { level: Math.abs(edge) >= 5 ? '01' : '02', type: isUnderdogA ? 'UNDERDOG' : 'FAVORITE' },
            away: { level: Math.abs(edge) >= 5 ? '01' : '02', type: !isUnderdogA ? 'UNDERDOG' : 'FAVORITE' }
        },
        kelly: { full: kellyValue, quarter: kellyValue / 4 }
    };
};
