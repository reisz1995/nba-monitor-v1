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

    let projectedPace = (blendedPaceA + blendedPaceB) / 1;

    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || [])
            .filter(i => i.isOut && i.weight >= 7)
            .reduce((sum) => sum + 0.1, 0); // Ajuste fino para 2025-26

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
        // Quando temos a métrica de 14 dias (databallr), assume-se 100% dos dados para eficiência cruzada ajustada
        if (databallrA!.ortg) offRtgA = databallrA!.ortg;
        if (databallrA!.drtg) defRtgA = databallrA!.drtg;
        if (databallrB!.ortg) offRtgB = databallrB!.ortg;
        if (databallrB!.drtg) defRtgB = databallrB!.drtg;
    }

    const matchPace = calculateDeterministicPace(
        entityA, entityB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB
    );

    let projectedScoreA: number;
    let projectedScoreB: number;

    // Eficiência Cruzada Ajustada (Média da força de ataque com a força da defesa oponente)
    const projEffA = (offRtgA + defRtgB) / 2;
    const projEffB = (offRtgB + defRtgA) / 2;

    projectedScoreA = projEffA * (matchPace / 100);
    projectedScoreB = projEffB * (matchPace / 100);

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

    // POWER_SCORE PENALTY E FILTROS DE DEFESA E ATAQUE ATIVADOS
    // Se o time for superior (PowerScore > rival), ele impõe a robustez de sua defesa e a explosão de seu ataque.
    // O filtro de defesa suprime a pontuação rival se a defesa (DRtg) do favorito for melhor (menor) que a do adversário.
    // O filtro de ataque sobrepuja se o ataque (ORtg) do favorito for melhor (maior) que o do adversário.
    const powerA = options?.aiScoreA ?? 0;
    const powerB = options?.aiScoreB ?? 0;
    const powerDiff = powerA - powerB;

    if (powerA > powerB) {
        projectedScoreA += powerDiff * 0.75;
        if (defRtgA < defRtgB) {
            const defenseFilter = (defRtgB - defRtgA) * 0.81;
            console.log(`[DEF_FILTER_ACTIVE] ${entityA.name} defesa suprime ${entityB.name}: -${defenseFilter.toFixed(1)}pts`);
            projectedScoreB -= defenseFilter;
        }
        if (offRtgA > offRtgB) {
            const attackFilter = (offRtgA - offRtgB) * 0.81;
            console.log(`[ATK_FILTER_ACTIVE] ${entityA.name} ataque sobrepuja ${entityB.name}: +${attackFilter.toFixed(1)}pts`);
            projectedScoreA += attackFilter;
        }
    } else if (powerB > powerA) {
        projectedScoreB += Math.abs(powerDiff) * 0.75;
        if (defRtgB < defRtgA) {
            const defenseFilter = (defRtgA - defRtgB) * 0.81;
            console.log(`[DEF_FILTER_ACTIVE] ${entityB.name} defesa suprime ${entityA.name}: -${defenseFilter.toFixed(1)}pts`);
            projectedScoreA -= defenseFilter;
        }
        if (offRtgB > offRtgA) {
            const attackFilter = (offRtgB - offRtgA) * 0.81;
            console.log(`[ATK_FILTER_ACTIVE] ${entityB.name} ataque sobrepuja ${entityA.name}: +${attackFilter.toFixed(1)}pts`);
            projectedScoreB += attackFilter;
        }
    }

    // BÔNUS DE ATAQUE ELITE: média de pontos >= 115 + comparação de POWER_SCORE
    const eliteThreshold = 115;
    if (powerA > powerB) {
        if (seasonPPG_A >= eliteThreshold) {
            console.log(`[ELITE_ATK_BONUS] ${entityA.name} PPG=${seasonPPG_A.toFixed(1)} + POWER superior: +10pts`);
            projectedScoreA += 10;
        }
    } else if (powerB > powerA) {
        if (seasonPPG_B >= eliteThreshold) {
            console.log(`[ELITE_ATK_BONUS] ${entityB.name} PPG=${seasonPPG_B.toFixed(1)} + POWER superior: +10pts`);
            projectedScoreB += 10;
        }
    } else {
        // POWER_SCORE igual: ambos ganham +5 se tiverem PPG >= 115
        if (seasonPPG_A >= eliteThreshold) {
            console.log(`[ELITE_ATK_BONUS] ${entityA.name} PPG=${seasonPPG_A.toFixed(1)} + POWER igual: +5pts`);
            projectedScoreA += 5;
        }
        if (seasonPPG_B >= eliteThreshold) {
            console.log(`[ELITE_ATK_BONUS] ${entityB.name} PPG=${seasonPPG_B.toFixed(1)} + POWER igual: +5pts`);
            projectedScoreB += 5;
        }
    }

    projectedScoreA -= calculatePenalty(options?.injuriesA);
    projectedScoreB -= calculatePenalty(options?.injuriesB);

    // Hard limits solicitados: mínimo 95, máximo 145
    projectedScoreA = Math.max(95, Math.min(145, projectedScoreA));
    projectedScoreB = Math.max(95, Math.min(145, projectedScoreB));

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

