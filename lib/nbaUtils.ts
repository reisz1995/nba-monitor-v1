import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number;
    lastMarginB?: number;
}

/**
 * Input de métricas avançadas do Databallr (últimos 14 dias).
 */
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

// Liga NBA 2025-26
const LEAGUE_AVG_ORTG = 115.5;
const LEAGUE_AVG_PACE = 99.7;
const LEAGUE_AVG_TOV  = 14.8;

// ─────────────────────────────────────────────────────────────────────────────
// PACE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getFallbackPace = (team: Team): number => {
    const offRtg = team.espnData?.pts || team.stats?.media_pontos_ataque || 115.5;
    return offRtg / (LEAGUE_AVG_ORTG / 100);
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    const seasonPace = team.pace || getFallbackPace(team);
    const recentPace = databallr?.pace;
    if (recentPace && recentPace > 0) {
        return (recentPace * 0.8) + (seasonPace * 0.2);
    }
    return seasonPace;
};

export const calculateDeterministicPace = (
    teamA: Team,
    teamB: Team,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null,
    // FIX v4.0: recebe lesões para reduzir pace quando há titulares OUT
    injuriesA?: { isOut: boolean; isDayToDay?: boolean; weight: number }[],
    injuriesB?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]
): number => {
    const blendedPaceA = getBlendedPace(teamA, databallrA);
    const blendedPaceB = getBlendedPace(teamB, databallrB);

    let projectedPace = (blendedPaceA + blendedPaceB) / 2;

    // FIX v4.0: Titulares de impacto OUT reduzem o pace do confronto
    // Cada jogador OUT com HW >= 7 retira 0.3 posses do ritmo projetado
    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || [])
            .filter(i => i.isOut && i.weight >= 7)
            .reduce((sum) => sum + 0.3, 0);

    projectedPace -= injuryPaceReduction(injuriesA);
    projectedPace -= injuryPaceReduction(injuriesB);

    const MIN_PACE = 98.0;
    const MAX_PACE = 108.0;
    const clampedPace = Math.max(MIN_PACE, Math.min(MAX_PACE, projectedPace));

    console.log(`[SYS-OP] Híbrido A: ${blendedPaceA.toFixed(1)} | Híbrido B: ${blendedPaceB.toFixed(1)}`);
    console.log(`[SYS-OP] Pace Projetado (Clamped): ${clampedPace.toFixed(2)}`);

    return clampedPace;
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX v4.0 — FILTRO DE DEFESA CALIBRADO
// Antes: dois blocos com valores fixos absurdos (+10/+10/+20) sem escala.
// Agora: função única, valores proporcionais, com zona neutra explícita.
// ─────────────────────────────────────────────────────────────────────────────
const defenseFilter = (defRtg: number): number => {
    if (defRtg >= 119) return +5.0;   // Defesa péssima → ataque adversário ganha pouco
    if (defRtg >= 116) return +3.0;
    if (defRtg >= 113) return +1.0;
    if (defRtg >= 111) return  0.0;   // Zona neutra (média da liga)
    if (defRtg >= 109) return -1.5;   // Defesa boa
    if (defRtg >= 106) return -3.0;   // Defesa muito boa
    return -5.0;                       // Defesa de elite (< 106)
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX v4.0 — PENALIDADE DE LESÃO COM DAY-TO-DAY
// Antes: Day-to-Day gerava penalidade ZERO (isOut = false → não entrava no if).
// Agora: D2D aplica 35% do peso do jogador como penalidade parcial.
// ─────────────────────────────────────────────────────────────────────────────
const calculatePenalty = (
    injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]
): number => {
    let p = 0;
    (injuries || []).forEach(inj => {
        if (inj.isOut) {
            // Colapso Sistêmico para superestrelas
            p += inj.weight >= 9 ? (inj.weight * 2.0) + 2 : inj.weight;
        } else if (inj.isDayToDay) {
            // FIX: Jogador D2D joga, mas com restrição → penalidade parcial de 35%
            p += inj.weight * 0.35;
        }
    });
    return p;
};

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR PRINCIPAL
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

    // ─── FONTE DE RATINGS ──────────────────────────────────────────────────
    let offRtgA = Number(entityA.espnData?.pts  || entityA.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    let defRtgA = Number(entityA.espnData?.pts_contra || entityA.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);
    let offRtgB = Number(entityB.espnData?.pts  || entityB.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    let defRtgB = Number(entityB.espnData?.pts_contra || entityB.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);

    if (hasDataballr) {
        // FIX v4.0: ORTG (pontos/100 posses) normalizado pelo pace antes de misturar com PPG
        // Sem isso, ORTG e PPG ficavam na mesma escala, inflando os ratings
        const paceNorm = (entityA.pace || LEAGUE_AVG_PACE) / 100;

        if (databallrA!.ortg) offRtgA = ((databallrA!.ortg * paceNorm) * 0.8) + (offRtgA * 0.2);
        if (databallrA!.drtg) defRtgA = ((databallrA!.drtg * paceNorm) * 0.8) + (defRtgA * 0.2);
        if (databallrB!.ortg) offRtgB = ((databallrB!.ortg * paceNorm) * 0.8) + (offRtgB * 0.2);
        if (databallrB!.drtg) defRtgB = ((databallrB!.drtg * paceNorm) * 0.8) + (defRtgB * 0.2);
    }

    // ─── PACE (agora recebe lesões para ajuste) ─────────────────────────────
    const matchPace = calculateDeterministicPace(
        entityA, entityB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB
    );

    // ─── PLACAR BASE ────────────────────────────────────────────────────────
    let projectedScoreA: number;
    let projectedScoreB: number;

    if (hasDataballr) {
        const effA = (offRtgA + defRtgB) / 2;
        const effB = (offRtgB + defRtgA) / 2;
        projectedScoreA = (effA / 100) * matchPace;
        projectedScoreB = (effB / 100) * matchPace;

        // Ajuste TS%
        const tsAvgLeague = 58.0;
        if (databallrA!.o_ts) projectedScoreA += (databallrA!.o_ts - tsAvgLeague) * 0.15;
        if (databallrB!.o_ts) projectedScoreB += (databallrB!.o_ts - tsAvgLeague) * 0.15;

        // Penalidade TOV
        if (databallrA!.o_tov && databallrA!.o_tov > LEAGUE_AVG_TOV)
            projectedScoreA -= (databallrA!.o_tov - LEAGUE_AVG_TOV) * 0.3;
        if (databallrB!.o_tov && databallrB!.o_tov > LEAGUE_AVG_TOV)
            projectedScoreB -= (databallrB!.o_tov - LEAGUE_AVG_TOV) * 0.3;

        // Bônus OReb
        if (databallrA!.orb && databallrA!.orb > 26)
            projectedScoreA += (databallrA!.orb - 26) * 0.2;
        if (databallrB!.orb && databallrB!.orb > 26)
            projectedScoreB += (databallrB!.orb - 26) * 0.2;
    } else {
        projectedScoreA = ((offRtgA + defRtgB) / 2.0) * (matchPace / 100.0);
        projectedScoreB = ((offRtgB + defRtgA) / 2.0) * (matchPace / 100.0);
    }

    // ─── AJUSTES SITUACIONAIS ───────────────────────────────────────────────
    if (options?.isHomeA) {
        projectedScoreA += 1.5;
        projectedScoreB -= 1.5;
    } else {
        projectedScoreB += 1.5;
        projectedScoreA -= 1.5;
    }

    if (options?.isB2BA) projectedScoreA -= 2.0;
    if (options?.isB2BB) projectedScoreB -= 2.0;

    if (options?.lastMarginA && options.lastMarginA > 20) projectedScoreA -= 1.5;
    if (options?.lastMarginB && options.lastMarginB > 20) projectedScoreB -= 1.5;

    // Jogo lento: comprime o spread (não inflaciona nem um nem outro)
    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        const adjustment = spread * 0.02;
        projectedScoreA -= adjustment / 2;
        projectedScoreB += adjustment / 2;
    }

    // ─── FILTRO DE DEFESA v4.0 (CALIBRADO) ─────────────────────────────────
    // FIX: Substituído bloco com +10/+10/+20 por função proporcional defenseFilter()
    projectedScoreA += defenseFilter(defRtgB); // Defesa dos Wolves afeta pontuação dos 76ers
    projectedScoreB += defenseFilter(defRtgA); // Defesa dos 76ers afeta pontuação dos Wolves

    // ─── PENALIDADE DE LESÃO v4.0 (COM DAY-TO-DAY) ─────────────────────────
    projectedScoreA -= calculatePenalty(options?.injuriesA);
    projectedScoreB -= calculatePenalty(options?.injuriesB);

    // ─── TRAVA DE SEGURANÇA ─────────────────────────────────────────────────
    const seasonAvgA = Number(entityA.espnData?.pts || entityA.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    const seasonAvgB = Number(entityB.espnData?.pts || entityB.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);

    const scoreFloorA = seasonAvgA - 20;
    const scoreFloorB = seasonAvgB - 20;

    if (projectedScoreA < scoreFloorA) {
        console.log(`[SAFE-LOCK] ${entityA.name}: ${projectedScoreA.toFixed(1)} -> ${scoreFloorA.toFixed(1)}`);
        projectedScoreA = scoreFloorA;
    }
    if (projectedScoreB < scoreFloorB) {
        console.log(`[SAFE-LOCK] ${entityB.name}: ${projectedScoreB.toFixed(1)} -> ${scoreFloorB.toFixed(1)}`);
        projectedScoreB = scoreFloorB;
    }

    const totalPayload = projectedScoreA + projectedScoreB;

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > 102.5
            ? 'HYPER_KINETIC'
            : (matchPace < 98 ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: hasDataballr,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS (sem alterações)
// ─────────────────────────────────────────────────────────────────────────────

export const getMomentumScore = (record: GameResult[]) => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null ? (res as any).result : res;
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
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

export const getPlayerWeight = (pts: number): number => Math.floor((pts || 0) / 3);

export const findTeamByName = (name: string, teams: any[]): any | null => {
    if (!name) return null;
    const clean = normalizeTeamName(name);
    return teams.find(t =>
        normalizeTeamName(t.name) === clean ||
        normalizeTeamName(t.name).includes(clean) ||
        clean.includes(normalizeTeamName(t.name))
    );
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

export const checkB2B = (teamName: string, dateStr: string, dbPredictions: any[]) => {
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
    analysis: any,
    marketSpread: number | null
) => {
    if (marketSpread === null) return null;
    const rules = [];
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
    const PACE_FACTOR = LEAGUE_AVG_ORTG / 100;
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
