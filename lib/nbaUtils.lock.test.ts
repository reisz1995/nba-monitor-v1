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
    /** Ataque relativo à média da liga (negativo = abaixo da média) */
    offense_rating?: number;
    /** Defesa relativa à média da liga */
    defense_rating?: number;
}

// Liga NBA 2025-26
const LEAGUE_AVG_ORTG = 115.5;
const LEAGUE_AVG_PACE = 99.7;
const LEAGUE_AVG_TOV  = 14.8;

// ─────────────────────────────────────────────────────────────────────────────
// FIX v4.1 — BLEND DINÂMICO
// Antes: peso fixo 80/20 para qualquer nível de divergência.
// Agora: quanto maior a divergência entre 14d e temporada, menos confiamos
//        nos 14 dias e mais ancoramos na temporada completa.
// ─────────────────────────────────────────────────────────────────────────────
const getDynamicBlendWeights = (
    recentRtg: number,
    seasonRtg: number
): { recentW: number; seasonW: number } => {
    const divergence = Math.abs(recentRtg - seasonRtg);
    if (divergence > 12) return { recentW: 0.50, seasonW: 0.50 }; // outlier extremo
    if (divergence > 8)  return { recentW: 0.60, seasonW: 0.40 }; // outlier moderado
    if (divergence > 5)  return { recentW: 0.70, seasonW: 0.30 }; // divergência normal
    return                      { recentW: 0.80, seasonW: 0.20 }; // dados estáveis
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX v4.1 — PACENORM IMPLÍCITO
// Antes: paceNorm = LEAGUE_AVG_PACE / 100 = 0.997 → quase inútil quando pace é NULL.
// Agora: deriva o pace real do time a partir do seu PPG da temporada.
//        Ex: PHI 116.6 PPG → impliedPace = 116.6 / 1.155 = 100.95 → paceNorm = 1.0095
// ─────────────────────────────────────────────────────────────────────────────
const getImpliedPaceNorm = (seasonPPG: number): number => {
    const impliedPace = seasonPPG / (LEAGUE_AVG_ORTG / 100);
    return impliedPace / 100;
};

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
        // Pace também usa blend dinâmico
        const { recentW, seasonW } = getDynamicBlendWeights(recentPace, seasonPace);
        return (recentPace * recentW) + (seasonPace * seasonW);
    }
    return seasonPace;
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

    // Titulares de impacto OUT reduzem o pace
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
// FIX v4.1 — FILTRO DE DEFESA NA ESCALA CORRETA
// Antes (v4.0): usava defRtg blendado com Databallr (escala ORTG/100 posses).
//   Resultado: MIN drtg blendado = 103 → disparava -5 pts em PHI (errado).
// Agora: recebe o PPG da temporada (pts_contra ESPN) — escala de pontos/jogo.
//   Resultado: MIN pts_contra = 114.1 → ajuste de +1.0 pt em PHI (correto).
// ─────────────────────────────────────────────────────────────────────────────
const defenseFilter = (defPPG_season: number): number => {
    if (defPPG_season >= 119) return +5.0;  // defesa péssima
    if (defPPG_season >= 116) return +3.0;
    if (defPPG_season >= 113) return +1.0;
    if (defPPG_season >= 111) return  0.0;  // zona neutra
    if (defPPG_season >= 109) return -1.5;  // defesa boa
    if (defPPG_season >= 106) return -3.0;  // defesa muito boa
    return -5.0;                             // defesa de elite
};

// ─────────────────────────────────────────────────────────────────────────────
// FIX v4.1 — OFFENSE_RATING COMO ÂNCORA DE FORMA RECENTE
// Campo offense_rating do Databallr = desempenho ofensivo relativo à liga (14d).
// Antes: completamente ignorado.
// Agora: quando o time está muito acima ou abaixo da média da liga nos 14 dias,
//        isso gera um bônus/penalidade amortecida (fator 0.15 para bônus, 0.25 para penalidade).
// Threshold: só ativa se |offense_rating| > 8 (sinal forte, não ruído).
// ─────────────────────────────────────────────────────────────────────────────
const getOffenseRatingAnchor = (offenseRating?: number): number => {
    if (offenseRating === undefined || offenseRating === null) return 0;
    if (offenseRating < -8)  return offenseRating * 0.25; // colapso ofensivo → penalidade
    if (offenseRating > 8)   return offenseRating * 0.15; // explosão ofensiva → bônus
    return 0; // zona neutra → sem ajuste
};

// ─────────────────────────────────────────────────────────────────────────────
// PENALIDADE DE LESÃO (com Day-to-Day, mantido do v4.0)
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
// MOTOR PRINCIPAL v4.1
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

    // ─── PPG DA TEMPORADA (âncora de escala real) ───────────────────────────
    const seasonPPG_A  = Number(entityA.espnData?.pts        || entityA.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    const seasonDEF_A  = Number(entityA.espnData?.pts_contra  || entityA.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);
    const seasonPPG_B  = Number(entityB.espnData?.pts        || entityB.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    const seasonDEF_B  = Number(entityB.espnData?.pts_contra  || entityB.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);

    // ─── RATINGS BLENDADOS (para cálculo de eficiência cruzada) ────────────
    let offRtgA = seasonPPG_A;
    let defRtgA = seasonDEF_A;
    let offRtgB = seasonPPG_B;
    let defRtgB = seasonDEF_B;

    if (hasDataballr) {
        // FIX v4.1: paceNorm implícito derivado do PPG da temporada (não LEAGUE_AVG_PACE fixo)
        const paceNormA = getImpliedPaceNorm(seasonPPG_A);
        const paceNormB = getImpliedPaceNorm(seasonPPG_B);

        // FIX v4.1: pesos dinâmicos baseados na divergência entre 14d e temporada
        if (databallrA!.ortg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrA!.ortg, seasonPPG_A);
            offRtgA = (databallrA!.ortg * paceNormA * recentW) + (seasonPPG_A * seasonW);
        }
        if (databallrA!.drtg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrA!.drtg, seasonDEF_A);
            defRtgA = (databallrA!.drtg * paceNormA * recentW) + (seasonDEF_A * seasonW);
        }
        if (databallrB!.ortg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrB!.ortg, seasonPPG_B);
            offRtgB = (databallrB!.ortg * paceNormB * recentW) + (seasonPPG_B * seasonW);
        }
        if (databallrB!.drtg) {
            const { recentW, seasonW } = getDynamicBlendWeights(databallrB!.drtg, seasonDEF_B);
            defRtgB = (databallrB!.drtg * paceNormB * recentW) + (seasonDEF_B * seasonW);
        }
    }

    // ─── PACE ────────────────────────────────────────────────────────────────
    const matchPace = calculateDeterministicPace(
        entityA, entityB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB
    );

    // ─── PLACAR BASE (eficiência cruzada) ────────────────────────────────────
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

        // FIX v4.1: offense_rating como âncora de forma recente
        // Captura o sinal de colapso/explosão ofensiva que o blend não consegue expressar totalmente
        projectedScoreA += getOffenseRatingAnchor(databallrA!.offense_rating);
        projectedScoreB += getOffenseRatingAnchor(databallrB!.offense_rating);

    } else {
        projectedScoreA = ((offRtgA + defRtgB) / 2.0) * (matchPace / 100.0);
        projectedScoreB = ((offRtgB + defRtgA) / 2.0) * (matchPace / 100.0);
    }

    // ─── AJUSTES SITUACIONAIS ────────────────────────────────────────────────
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

    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        const adjustment = spread * 0.02;
        projectedScoreA -= adjustment / 2;
        projectedScoreB += adjustment / 2;
    }

    // ─── FILTRO DE DEFESA v4.1 (escala PPG temporada) ───────────────────────
    // FIX: usa seasonDEF (pts_contra ESPN), NÃO o defRtg blendado com Databallr.
    // O defRtg blendado está em escala ORTG (por 100 posses) e não é comparável
    // à tabela do defenseFilter, que foi calibrada em pontos reais por jogo.
    projectedScoreA += defenseFilter(seasonDEF_B); // defesa dos Wolves afeta PHI
    projectedScoreB += defenseFilter(seasonDEF_A); // defesa dos 76ers afeta MIN

    // ─── PENALIDADE DE LESÃO v4.0 (com Day-to-Day) ──────────────────────────
    projectedScoreA -= calculatePenalty(options?.injuriesA);
    projectedScoreB -= calculatePenalty(options?.injuriesB);

    // ─── TRAVA DE SEGURANÇA ──────────────────────────────────────────────────
    const scoreFloorA = seasonPPG_A - 20;
    const scoreFloorB = seasonPPG_B - 20;

    if (projectedScoreA < scoreFloorA) {
        console.log(`[SAFE-LOCK] ${entityA.name}: ${projectedScoreA.toFixed(1)} -> ${scoreFloorA.toFixed(1)}`);
        projectedScoreA = scoreFloorA;
    }
    if (projectedScoreB < scoreFloorB) {
        console.log(`[SAFE-LOCK] ${entityB.name}: ${projectedScoreB.toFixed(1)} -> ${scoreFloorB.toFixed(1)}`);
        projectedScoreB = scoreFloorB;
    }

    const totalPayload = projectedScoreA + projectedScoreB;

    console.log(`[v4.1] PHI: ${projectedScoreA.toFixed(1)} | MIN: ${projectedScoreB.toFixed(1)} | Total: ${totalPayload.toFixed(1)}`);

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
