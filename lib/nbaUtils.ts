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
    AVG_ORTG: 116.9,
    AVG_PACE: 99.2,
    AVG_TOV: 13.9,
    AVG_TS: 57.5,
    MIN_PACE: 98.0,
    MAX_PACE: 107.0,
    AVG_ORB: 25.5
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

    let projectedPace = (blendedPaceA * blendedPaceB) / SEASON_25_26_METRICS.AVG_PACE;

    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || [])
            .filter(i => i.isOut && i.weight >= 7)
            .reduce((sum) => sum + 0.35, 0); // Ajuste fino para 2025-26

    projectedPace -= injuryPaceReduction(injuriesA);
    projectedPace -= injuryPaceReduction(injuriesB);

    const clampedPace = Math.max(SEASON_25_26_METRICS.MIN_PACE, Math.min(SEASON_25_26_METRICS.MAX_PACE, projectedPace));

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
            p += inj.weight * 0.35;
        }
    });
    return p;
};

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL DE PROJEÇÃO (v4.3) - INTERAÇÃO CONTÍNUA
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

    // Extração do Pace Secundário (Temporada) para conversão em Rating (/100)
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
        if (databallrA!.ortg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrA!.ortg, seasonOrtgA);
            offRtgA = (databallrA!.ortg * recentW) + (seasonOrtgA * seasonW);
        }
        if (databallrA!.drtg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrA!.drtg, seasonDrtgA);
            defRtgA = (databallrA!.drtg * recentW) + (seasonDrtgA * seasonW);
        }
        if (databallrB!.ortg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrB!.ortg, seasonOrtgB);
            offRtgB = (databallrB!.ortg * recentW) + (seasonOrtgB * seasonW);
        }
        if (databallrB!.drtg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrB!.drtg, seasonDrtgB);
            defRtgB = (databallrB!.drtg * recentW) + (seasonDrtgB * seasonW);
        }
    }

    const matchPace = calculateDeterministicPace(
        entityA, entityB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB
    );

    let projectedScoreA: number;
    let projectedScoreB: number;

    // Ajuste de Eficiência Contínuo: ORTG_A + (DRTG_B - Lg_Avg_ORTG)
    const lg_avg_eff = SEASON_25_26_METRICS.AVG_ORTG;
    const adjEffA = offRtgA + (defRtgB - lg_avg_eff);
    const adjEffB = offRtgB + (defRtgA - lg_avg_eff);

    projectedScoreA = (adjEffA / 100) * matchPace;
    projectedScoreB = (adjEffB / 100) * matchPace;

    if (hasDataballr) {
        if (databallrA!.o_ts) projectedScoreA += (databallrA!.o_ts - SEASON_25_26_METRICS.AVG_TS) * 2;
        if (databallrB!.o_ts) projectedScoreB += (databallrB!.o_ts - SEASON_25_26_METRICS.AVG_TS) * 2;

        if (databallrA!.o_tov && databallrA!.o_tov > SEASON_25_26_METRICS.AVG_TOV)
            projectedScoreA -= (databallrA!.o_tov - SEASON_25_26_METRICS.AVG_TOV) * 1;
        if (databallrB!.o_tov && databallrB!.o_tov > SEASON_25_26_METRICS.AVG_TOV)
            projectedScoreB -= (databallrB!.o_tov - SEASON_25_26_METRICS.AVG_TOV) * 1;

        if (databallrA!.orb && databallrA!.orb > SEASON_25_26_METRICS.AVG_ORB)
            projectedScoreA += (databallrA!.orb - SEASON_25_26_METRICS.AVG_ORB) * 1;
        if (databallrB!.orb && databallrB!.orb > SEASON_25_26_METRICS.AVG_ORB)
            projectedScoreB += (databallrB!.orb - SEASON_25_26_METRICS.AVG_ORB) * 1;

        projectedScoreA += getOffenseRatingAnchor(databallrA!.offense_rating);
        projectedScoreB += getOffenseRatingAnchor(databallrB!.offense_rating);
    }

    if (options?.isHomeA) {
        projectedScoreA += 3;
        projectedScoreB -= 3;
    } else {
        projectedScoreB += 3;
        projectedScoreA -= 3;
    }

    if (options?.isB2BA) projectedScoreA -= 1.0;
    if (options?.isB2BB) projectedScoreB -= 1.0;

    if (options?.lastMarginA && options.lastMarginA > 20) projectedScoreA -= 1.5;
    if (options?.lastMarginB && options.lastMarginB > 20) projectedScoreB -= 1.5;

    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        const adjustment = spread * 0.02;
        projectedScoreA -= adjustment / 3;
        projectedScoreB += adjustment / 3;
    }

    // POWER_SCORE PENALTY / EDGE SUBSTITUTO DO DEFENSE_FILTER 
    // Como a Defesa (DRTG) agora atua em espectro contínuo, não usamos mais o 'defenseFilter' (escadas de penalidade).
    // O Power Score atua apenas no Edge Qualitativo/Invisível (Até ~2.5 pontos por mérito intangível)
    const powerA = options?.aiScoreA ?? 0;
    const powerB = options?.aiScoreB ?? 0;
    const powerDiff = powerA - powerB;

    if (powerA > powerB) {
        projectedScoreA += Math.min(2.5, powerDiff * 0.75);
    } else if (powerB > powerA) {
        projectedScoreB += Math.min(2.5, Math.abs(powerDiff) * 0.75);
    }

    projectedScoreA -= calculatePenalty(options?.injuriesA);
    projectedScoreB -= calculatePenalty(options?.injuriesB);

    const scoreFloorA = seasonPPG_A - 17;
    const scoreFloorB = seasonPPG_B - 17;

    if (projectedScoreA < scoreFloorA) {
        console.log(`[SAFE-LOCK] ${entityA.name}: ${projectedScoreA.toFixed(1)} -> ${scoreFloorA.toFixed(1)}`);
        projectedScoreA = scoreFloorA;
    }
    if (projectedScoreB < scoreFloorB) {
        console.log(`[SAFE-LOCK] ${entityB.name}: ${projectedScoreB.toFixed(1)} -> ${scoreFloorB.toFixed(1)}`);
        projectedScoreB = scoreFloorB;
    }

    const totalPayload = projectedScoreA + projectedScoreB;

    console.log(`[v4.3] ${entityA.name}: ${projectedScoreA.toFixed(1)} | ${entityB.name}: ${projectedScoreB.toFixed(1)} | Payload: ${totalPayload.toFixed(1)}`);

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > 105.5
            ? 'HYPER_KINETIC'
            : (matchPace < 100.5 ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: hasDataballr,
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
    const clean = normalizeTeamName(name);
    return teams.find(t =>
        normalizeTeamName(t.name) === clean ||
        normalizeTeamName(t.name).includes(clean) ||
        clean.includes(normalizeTeamName(t.name))
    ) || null;
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

    return { hasValue: rules.length >= 2, rules, edge: edge.toFixed(1) };
};

export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0], 10);
    const pts2 = parseInt(parts[1], 10);
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

