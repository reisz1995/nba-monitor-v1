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
// ─────────────────────────────────────────────────────────────────────────────
const SEASON_25_26_METRICS = {
    AVG_ORTG: 115.5,
    AVG_PACE: 99.3,
    AVG_TOV: 14.8,
    AVG_TS: 58.8,
    MIN_PACE: 99.3,
    MAX_PACE: 107.0,
    AVG_ORB: 23.5
} as const;

const PROJECTION_CONFIG = {
    POWER_DIFF_WEIGHT: 0.85,
    DEF_FILTER_FAVORITE_MULT: 2.5,
    DEF_FILTER_UNDERDOG_MULT: 2.5,
    ATK_FILTER_MULT: 0.75,
    HOME_ADVANTAGE: 1.75,
    LAST_MARGIN_THRESHOLD: 22,
    LAST_MARGIN_PENALTY: 1.5,
    SCORE_FLOOR_MIN: 95,
    SCORE_CEILING_MAX: 148,
    PACE_ADJUSTMENT_FACTOR: 0.5,
    PACE_THRESHOLD_SLOW: 97.5
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// AUXILIARES DE PACE & RATINGS
// ─────────────────────────────────────────────────────────────────────────────
const getFallbackPace = (team: Team): number => {
    const offRtg = team.espnData?.pts || team.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG;
    return offRtg / (SEASON_25_26_METRICS.AVG_ORTG / 100);
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    const recentPace = databallr?.pace;
    if (recentPace && recentPace > 0) return recentPace;
    return SEASON_25_26_METRICS.AVG_PACE;
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
    rtgB?: { defRtg: number },
    powerA: number = 0,
    powerB: number = 0
): number => {
    const blendedPaceA = getBlendedPace(teamA, databallrA);
    const blendedPaceB = getBlendedPace(teamB, databallrB);

    let projectedPace: number;
    const powerDiff = Math.abs(powerA - powerB);

    // LÓGICA DE CONTROLE DEFENSIVO
    if (rtgA && rtgB) {
        const defDelta = rtgB.defRtg - rtgA.defRtg; // Positivo se A for melhor defesa

        // Fator de Controle: Quanto maior a diferença, mais o ritmo pende para o melhor
        const controlFactor = Math.min(0.20, Math.abs(defDelta) / 40);

        if (powerDiff = 2) {
            // (Defensive Control II) Confrontos de times desequilibrados
            if (defDelta > 0) {
                // Time A tem a melhor defesa -> Peso 0.9 + controlFactor
                projectedPace = (blendedPaceA * (0.9 + controlFactor)) + (blendedPaceB * (0.2 - controlFactor));
            } else {
                // Time B tem a melhor defesa -> Peso 0.9 + controlFactor
                projectedPace = (blendedPaceA * (0.2 - controlFactor)) + (blendedPaceB * (0.9 + controlFactor));
            }
        } else {
            // (Defensive Control I) Confrontos equilibrados (diff < 2.0)
            if (defDelta > 0) {
                projectedPace = (blendedPaceA * (0.7 + controlFactor)) + (blendedPaceB * (0.2 - controlFactor));
            } else {
                projectedPace = (blendedPaceA * (0.2 - controlFactor)) + (blendedPaceB * (0.7 + controlFactor));
            }
        }
        console.log(`[SYS-OP] Pace Control: ${projectedPace.toFixed(2)} (DefDelta: ${defDelta.toFixed(1)}, PowerDiff: ${powerDiff.toFixed(1)})`);
    } else {
        // Fallback para média simples se não houver ratings
        projectedPace = (blendedPaceA + blendedPaceB) / 2;
    }

    // Ajustes de lesões
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
        adjA -= adjustment; adjB += adjustment;
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
        teamA,
        teamB,
        databallrA,
        databallrB,
        options?.injuriesA,
        options?.injuriesB,
        rtgA,
        rtgB,
        options?.aiScoreA ?? 0,
        options?.aiScoreB ?? 0
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
// UTILITÁRIOS E PARSERS (SISTEMA COMPLETO)
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
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];

    const playedYesterday = dbPredictions.some(p =>
        (p.home_team.toLowerCase().includes(teamName.toLowerCase()) || p.away_team.toLowerCase().includes(teamName.toLowerCase())) && p.date === yStr
    );
    const playsTomorrow = dbPredictions.some(p =>
        (p.home_team.toLowerCase().includes(teamName.toLowerCase()) || p.away_team.toLowerCase().includes(teamName.toLowerCase())) && p.date === tStr
    );
    return { yesterday: playedYesterday, tomorrow: playsTomorrow };
};

export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0], 10);
    const pts2 = parseInt(parts[1], 10);
    return isNaN(pts1) || isNaN(pts2) ? 0 : pts1 + pts2;
};

export const calculateMatchupPaceV2 = (teamA: Team, teamB: Team) => {
    const PACE_FACTOR = SEASON_25_26_METRICS.AVG_ORTG / 100;
    const getGamePace = (score: string) => parseScoreToTotal(score) / (2 * PACE_FACTOR);
    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0 ? last5A.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5A.length : 0;
    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0 ? last5B.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5B.length : 0;
    const normB = normalizeTeamName(teamB.name);
    const h2hGames = (teamA.record || []).filter(g => g.opponent && normalizeTeamName(g.opponent).includes(normB)).slice(-2);
    let avgPaceH2H = 0;
    if (h2hGames.length > 0) {
        avgPaceH2H = h2hGames.reduce((sum, g) => sum + getGamePace(g.score), 0) / h2hGames.length;
    } else if (avgPace5A > 0 && avgPace5B > 0) {
        avgPaceH2H = (avgPace5A + avgPace5B) / 2;
    }
    let finalPace = 0;
    if (avgPace5A > 0 && avgPace5B > 0 && avgPaceH2H > 0) finalPace = (avgPace5A + avgPace5B + avgPaceH2H) / 3;
    return { matchPace: finalPace, avgPace5A, avgPace5B, avgPaceH2H, hasH2H: h2hGames.length > 0 };
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
    return { hasValue: rules.length >= 2, rules, edge: edge.toFixed(1), levels: { home: 0, away: 0 }, kelly: 0 };
};
