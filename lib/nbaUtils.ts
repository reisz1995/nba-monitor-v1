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
    AVG_ORTG: 116.9,
    AVG_PACE: 99.2,
    AVG_TOV: 13.9,
    AVG_TS: 57.5,
    MIN_PACE: 98.0,
    MAX_PACE: 107.0,
    AVG_ORB: 25.5
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SUBSISTEMA DE PACE
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

    let projectedPace = (blendedPaceA + blendedPaceB) / 2;

    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || [])
            .filter(i => i.isOut && i.weight >= 7)
            .reduce((sum) => sum + 0.5, 0); // CORREÇÃO: 0.5 é um impacto real no Pace

    projectedPace -= injuryPaceReduction(injuriesA);
    projectedPace -= injuryPaceReduction(injuriesB);

    return projectedPace;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS E PENALIDADES
// ─────────────────────────────────────────────────────────────────────────────
const calculatePenalty = (
    injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]
): number => {
    let p = 0;
    (injuries || []).forEach(inj => {
        if (inj.isOut) {
            p += inj.weight >= 9 ? (inj.weight * 2.0) + 2 : inj.weight;
        } else if (inj.isDayToDay) {
            p += inj.weight * 0.35;
        }
    });
    return p;
};

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL DE PROJEÇÃO (v4.4) - SINCRONIZADO COM TESTES
// ─────────────────────────────────────────────────────────────────────────────
export const calculateProjectedScores = (
    entityA: Team,
    entityB: Team,
    options?: PaceOptions & {
        injuriesA?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
        injuriesB?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
    },
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
) => {
    const hasDataballr = !!(databallrA?.ortg && databallrB?.ortg);

    const seasonPPG_A = Number(entityA.espnData?.pts || entityA.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG);
    const seasonDEF_A = Number(entityA.espnData?.pts_contra || entityA.stats?.media_pontos_defesa || SEASON_25_26_METRICS.AVG_ORTG);
    const seasonPPG_B = Number(entityB.espnData?.pts || entityB.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG);
    const seasonDEF_B = Number(entityB.espnData?.pts_contra || entityB.stats?.media_pontos_defesa || SEASON_25_26_METRICS.AVG_ORTG);

    const seasonPaceA = Number(entityA.espnData?.pace) || getFallbackPace(entityA);
    const seasonPaceB = Number(entityB.espnData?.pace) || getFallbackPace(entityB);

    const seasonOrtgA = (seasonPPG_A / seasonPaceA) * 100;
    const seasonDrtgA = (seasonDEF_A / seasonPaceA) * 100;
    const seasonOrtgB = (seasonPPG_B / seasonPaceB) * 100;
    const seasonDrtgB = (seasonDEF_B / seasonPaceB) * 100;

    let offRtgA = seasonOrtgA;
    let defRtgA = seasonDrtgA;
    let offRtgB = seasonOrtgB;
    let defRtgB = seasonDrtgB;

    if (hasDataballr) {
        if (databallrA?.ortg) offRtgA = databallrA.ortg;
        if (databallrA?.drtg) defRtgA = databallrA.drtg;
        if (databallrB?.ortg) offRtgB = databallrB.ortg;
        if (databallrB?.drtg) defRtgB = databallrB.drtg;
    }

    const matchPace = calculateDeterministicPace(
        entityA, entityB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB
    );

    // CORREÇÃO 1: Divisor 2.0 para média estatística real (não inflacionada)
    const projEffA = (offRtgA + defRtgB) / 2.0;
    const projEffB = (offRtgB + defRtgA) / 2.0;

    let projectedScoreA = projEffA * (matchPace / 100);
    let projectedScoreB = projEffB * (matchPace / 100);

    // Ajustes de Regressão
    if (options?.lastMarginA && options.lastMarginA > 20) projectedScoreA -= 1;
    if (options?.lastMarginB && options.lastMarginB > 20) projectedScoreB -= 1;

    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        const adjustment = spread * 0.02;
        projectedScoreA -= adjustment;
        projectedScoreB += adjustment;
    }

    // Filtros de Power Score
    const powerA = options?.aiScoreA ?? 0;
    const powerB = options?.aiScoreB ?? 0;
    const powerDiff = powerA - powerB;

    if (powerA > powerB) {
        projectedScoreA += powerDiff * 0.75;
        if (defRtgA < defRtgB) projectedScoreB -= (defRtgB - defRtgA) * 0.81;
        if (offRtgA > offRtgB) projectedScoreA += (offRtgA - offRtgB) * 0.81;
    } else if (powerB > powerA) {
        projectedScoreB += Math.abs(powerDiff) * 0.75;
        if (defRtgB < defRtgA) projectedScoreA -= (defRtgA - defRtgB) * 0.81;
        if (offRtgB > offRtgA) projectedScoreB += (offRtgB - offRtgA) * 0.81;
    }

    // CORREÇÃO 2: Home Advantage Balanceado (evitando o erro de -10 pts)
    if (options?.isHomeA) {
        projectedScoreA += 1.5;
        projectedScoreB -= 1.5;
    } else {
        projectedScoreB += 1.5;
        projectedScoreA -= 1.5;
    }
    
    projectedScoreA -= calculatePenalty(options?.injuriesA);
    projectedScoreB -= calculatePenalty(options?.injuriesB);

    // CORREÇÃO 3: Trava de Segurança Profissional (Sincronizada com Testes)
    const floorA = seasonPPG_A - 17;
    const floorB = seasonPPG_B - 17;

    projectedScoreA = Math.max(95, Math.max(floorA, projectedScoreA));
    projectedScoreB = Math.max(95, Math.max(floorB, projectedScoreB));

    // Teto absoluto
    projectedScoreA = Math.min(145, projectedScoreA);
    projectedScoreB = Math.min(145, projectedScoreB);

    const totalPayload = projectedScoreA + projectedScoreB;

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > 105.5 ? 'HYPER_KINETIC' : (matchPace < 100.5 ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: hasDataballr,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS E PARSERS
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

export const normalizeTeamName = (name: string): string => {
    if (!name) return '';
    return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

export const getStandardTeamName = (name: string): string => {
    if (!name) return '';
    const n = name.trim();
    if (n === 'LA Clippers') return 'Los Angeles Clippers';
    return n;
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

    return { hasValue: rules.length >= 2, rules, edge: edge.toFixed(1) };
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
