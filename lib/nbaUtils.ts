import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number;
    lastMarginB?: number;
    powerA?: number;
    powerB?: number;
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
// HUD DE CONFIGURAÇÃO - KERNEL V5.1 (Matriz Híbrida)
// ─────────────────────────────────────────────────────────────────────────────
const SEASON_25_26_METRICS = {
    AVG_ORTG: 115.5,
    AVG_PACE: 99.3,
    AVG_TOV: 14.8,
    AVG_TS: 58.8,
    MIN_PACE: 95.0,
    MAX_PACE: 107.0,
    AVG_ORB: 23.5
} as const;

const PROJECTION_CONFIG = {
    // Peso do Power Score na pontuação final (Ajustado para não inflar)
    POWER_DIFF_WEIGHT: 1.1,
    DEF_FILTER_FAVORITE_MULT: 2.5,
    DEF_FILTER_UNDERDOG_MULT: 1.4,
    ATK_FILTER_MULT: 0.75,
    HOME_ADVANTAGE: 1.75,
    LAST_MARGIN_THRESHOLD: 22,
    LAST_MARGIN_PENALTY: 1.5,
    SCORE_FLOOR_MIN: 92,
    SCORE_CEILING_MAX: 148,
    PACE_ADJUSTMENT_FACTOR: 0.03,
    PACE_THRESHOLD_SLOW: 97.5,
    // V5.1 Specifics
    OVERCLOCK_THRESHOLD: 2.0,
    OVERCLOCK_BOOST: 1.04, // +4% de aceleração de payload
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// AUXILIARES DE PACE & RATINGS
// ─────────────────────────────────────────────────────────────────────────────
const getFallbackPace = (): number => {
    return SEASON_25_26_METRICS.AVG_PACE;
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    const recentPace = databallr?.pace;
    if (recentPace && recentPace > 0) return recentPace;
    return getFallbackPace();
};

const getTeamRatings = (entity: Team, databallr?: DataballrInput | null) => {
    const ppg = Number(entity.espnData?.pts || entity.stats?.media_pontos_ataque || SEASON_25_26_METRICS.AVG_ORTG);
    const def = Number(entity.espnData?.pts_contra || entity.stats?.media_pontos_defesa || SEASON_25_26_METRICS.AVG_ORTG);
    
    // Usa getBlendedPace para manter coerência com o matchPace calculado depois
    const pace = getBlendedPace(entity, databallr);

    return {
        offRtg: databallr?.ortg || (ppg / pace) * 100,
        defRtg: databallr?.drtg || (def / pace) * 100,
        seasonPPG: ppg,
        pace  // agora reflete o mesmo pace que será usado na projeção
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSISTEMA DE PACE (v5.1 - MATRIZ HÍBRIDA)
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
    powerB: number = 0,
    h2hFromDefense?: any[]
): number => {
    const paceA = getBlendedPace(teamA, databallrA);
    const paceB = getBlendedPace(teamB, databallrB);

    const powerDiff = Math.abs(powerA - powerB);
    const strongestTeamPace = powerA >= powerB ? paceA : paceB;
    const bestDefenderPace = (rtgA && rtgB && rtgA.defRtg < rtgB.defRtg) ? paceA : paceB;

    // [MATRIZ HÍBRIDA V5.1]
    // Força (70%) dita a velocidade | Defesa (30%) atua como atrito
    let basePace = (strongestTeamPace * 0.60) + (bestDefenderPace * 0.40);

    // [INFLUÊNCIA H2H] - Se dados de colisão direta existirem, pesam 25% no pace base
    if (h2hFromDefense && h2hFromDefense.length > 0) {
        const PACE_FACTOR = SEASON_25_26_METRICS.AVG_ORTG / 100;
        const h2hPace = h2hFromDefense.reduce((sum, g) => {
            const total = parseScoreToTotal(g.score);
            return sum + (total / (2 * PACE_FACTOR));
        }, 0) / h2hFromDefense.length;

        if (h2hPace > 0) {
            basePace = (basePace * 0.90) + (h2hPace * 0.10);
        }
    }

    let projectedPace = basePace;

    // [GATILHO DE OVERCLOCK]
    // Se a disparidade de força for severa, injeta aceleração para evitar o "Defensive Lock"
    if (powerDiff >= PROJECTION_CONFIG.OVERCLOCK_THRESHOLD) {
        projectedPace *= PROJECTION_CONFIG.OVERCLOCK_BOOST;
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] OVERCLOCK ATIVADO: PowerDiff ${powerDiff.toFixed(1)} -> Payload Acelerado`);
        }
    }

    // Ajustes de lesões (Alocação Zero)
    const injuryPaceReduction = (injuries?: { isOut: boolean; weight: number }[]) =>
        (injuries || []).filter(i => i.isOut && i.weight >= 7).reduce((sum, _) => sum + 0.1, 0);

    projectedPace -= (injuryPaceReduction(injuriesA) + injuryPaceReduction(injuriesB));

    if (process.env.NODE_ENV === 'development') {
        console.log(`[KERNEL V5.1] Pace: ${projectedPace.toFixed(2)} | Driver: ${powerA >= powerB ? 'TeamA' : 'TeamB'}`);
    }
    return projectedPace;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS E PENALIDADES
// ─────────────────────────────────────────────────────────────────────────────
const calculatePenalty = (injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]): number => {
    let p = 0;
    (injuries || []).forEach(inj => {
        if (inj.isOut) p += inj.weight >= 9 ? (inj.weight * 2.0) + 2 : inj.weight;
        else if (inj.isDayToDay) p += inj.weight * 0.10;
    });
    return p;
};

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL DE PROJEÇÃO (v5.1)
// ─────────────────────────────────────────────────────────────────────────────
const applyContextualAdjustments = (scoreA: number, scoreB: number, matchPace: number, options?: PaceOptions) => {
    let adjA = scoreA;
    let adjB = scoreB;
    if (options?.isB2BA) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.isB2BB) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginA && options.lastMarginA > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginB && options.lastMarginB > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;

    // [V5.1] Reduz o total projetado para pace lento em vez de apenas redistribuir o spread
    if (matchPace < PROJECTION_CONFIG.PACE_THRESHOLD_SLOW) {
        const reduction = 1 - PROJECTION_CONFIG.PACE_ADJUSTMENT_FACTOR;
        adjA *= reduction;
        adjB *= reduction;
    }
    return { adjA, adjB };
};


// ─────────────────────────────────────────────────────────────────────────────
// KERNEL V5.3.4 - PATCH: PROTOCOLO DE COLAPSO DEFENSIVO E VÁCUO
// ─────────────────────────────────────────────────────────────────────────────
const applySuperiorityFilters = (scoreA: number, scoreB: number, teamA: Team, teamB: Team, rtgA: { offRtg: number; defRtg: number }, rtgB: { offRtg: number; defRtg: number }, powerA: number, powerB: number) => {
    let adjA = scoreA;
    let adjB = scoreB;
    const powerDiff = Math.abs(powerA - powerB);

    // [ ESTADO DE TRINCHEIRA ]: Diferença de força inferior a 1.5
    const isDogfight = powerDiff < 0.5;

    // [ GATILHO DE RUPTURA CIRÚRGICA ]: Exige que AMBAS as equipes sejam letais no ataque
    const combinedOffense = (rtgA.offRtg + rtgB.offRtg) / 2;
    const isShootout = combinedOffense >= 120.5 && rtgA.offRtg >= 113.0 && rtgB.offRtg >= 113.0;

    // [ GATILHO DE VÁCUO DEFENSIVO ]: Exige que AMBAS as equipes tenham defesas colapsadas
    const combinedDefense = (rtgA.defRtg + rtgB.defRtg) / 2;
    const isDefensiveCollapse = combinedDefense >= 114.5 && rtgA.defRtg >= 114.0 && rtgB.defRtg >= 114.0;

    // OTIMIZAÇÃO: A eficiência de ataque é restaurada em Shootouts E em Colapsos Defensivos
    const currentAtkMult = (isDogfight && !isShootout && !isDefensiveCollapse)
        ? (PROJECTION_CONFIG.ATK_FILTER_MULT * 0.9)
        : PROJECTION_CONFIG.ATK_FILTER_MULT;

    const applyTeamSuperiorityV5 = (targetScore: number, opponentScore: number, targetRtg: any, opponentRtg: any, isFavorite: boolean) => {
        let adjT = targetScore;
        let adjO = opponentScore;
        if (targetRtg.defRtg < opponentRtg.defRtg) {
            const mult = isFavorite ? PROJECTION_CONFIG.DEF_FILTER_FAVORITE_MULT : PROJECTION_CONFIG.DEF_FILTER_UNDERDOG_MULT;
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
    // Empate de poder: cada time aplica seus ajustes de eficiência de forma independente
    // A vantagem de ataque de A sobre B afeta o score de A
    // A vantagem defensiva de A sobre B reduz o score de B
    // (e vice-versa para o time B) — sem cancelamento por média
    const supA = applyTeamSuperiorityV5(adjA, adjB, rtgA, rtgB, false);
    const supB = applyTeamSuperiorityV5(adjB, adjA, rtgB, rtgA, false);

    // supA.adjT = score de A ajustado pelo próprio ataque
    // supA.adjO = score de B ajustado pela defesa de A
    // supB.adjT = score de B ajustado pelo próprio ataque
    // supB.adjO = score de A ajustado pela defesa de B
    adjA = (supA.adjT + supB.adjO) / 2;  // média do que A merece ofensivamente + o que B concede
    adjB = (supB.adjT + supA.adjO) / 2;  // média do que B merece ofensivamente + o que A concede

    // PATCH: Se os ratings forem idênticos, os ajustes se cancelam (comportamento correto).
    // Se forem diferentes, o time mais eficiente leva vantagem — sem depender do powerDiff.
    // Nenhuma mudança de lógica necessária além da clareza acima, MAS:
    // Adicione um log para monitorar se os empates estão gerando spreads zero:
    if (process.env.NODE_ENV === 'development') {
        console.log(`[EMPATE] adjA=${adjA.toFixed(1)} adjB=${adjB.toFixed(1)} | spread=${(adjA - adjB).toFixed(1)}`);
    }
}
    // ─────────────────────────────────────────────────────────────────────────────
    // MATRIZ DE GRAVIDADE MULTI-VETORIAL (V5.3.4)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isShootout) {
        // [ STATUS ]: Tiroteio de Elite
        const shootoutBonus = Math.min((combinedOffense - 120.0) * 0.8, 3.0);
        if (shootoutBonus > 0) {
            adjA += shootoutBonus;
            adjB += shootoutBonus;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[SYS-OP] RUPTURA OFFENSIVA: +${shootoutBonus.toFixed(1)} pts alocados.`);
            }
        }
    } else if (isDefensiveCollapse) {
        // [ STATUS ]: Vácuo Defensivo. Equipes não marcam. Inversão da penalidade de trincheira.
        const collapseBonus = Math.min((combinedDefense - 116.0) * 1.2, 4.5);
        adjA += collapseBonus;
        adjB += collapseBonus;
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] COLAPSO DEFENSIVO: +${collapseBonus.toFixed(1)} pts alocados (Ausência de Atrito).`);
        }
    } else if (isDogfight) {
        // [ STATUS ]: Retém a perfeição do placar padrão (Atrito aplicado APENAS para times que defendem)
        adjA -= 3.5;
        adjB -= 3.5;
    }

    return { adjA, adjB };
};


// ─────────────────────────────────────────────────────────────────────────────
// KERNEL V5.2 - PATCH 2: CORREÇÃO DO FILTRO DE VOLATILIDADE
// ─────────────────────────────────────────────────────────────────────────────
const applyVolatilityFilter = (scoreA: number, scoreB: number, databallrA?: DataballrInput | null, databallrB?: DataballrInput | null, powerA: number = 0, powerB: number = 0) => {
    let adjA = scoreA;
    let adjB = scoreB;
    const netA = databallrA?.net_rating ?? 0;
    const netB = databallrB?.net_rating ?? 0;

    // OTIMIZAÇÃO: A inflação matemática indiscriminada (Math.abs) foi erradicada.
    // OTIMIZAÇÃO: Condição >= 0 permite ativação com defaults
    if (powerA >= 0 && powerB >= 0 && powerA <= 3.5 && powerB <= 3.5) {

        // A equipe explora falhas: Lucra apenas se o oponente tiver Net Rating NEGATIVO (Teto: +4.0 pts)
        if (netB < 0) adjA += Math.min(Math.abs(netB), 4.0);
        if (netA < 0) adjB += Math.min(Math.abs(netA), 4.0);

        // A equipe sofre pelo próprio defeito: Penalizada se o seu Net Rating for NEGATIVO (Teto: -3.0 pts)
        if (netA < 0) adjA -= Math.min(Math.abs(netA) * 0.6, 3.0);
        if (netB < 0) adjB -= Math.min(Math.abs(netB) * 0.6, 3.0);
    }

    return { adjA, adjB };
};

const clampScores = (scoreA: number, scoreB: number, floorA: number, floorB: number, matchPace?: number) => {
    // Floor dinâmico: reduz em 2pts para cada 2pts de pace abaixo de 99.3 (média da liga)
    const avgPace = SEASON_25_26_METRICS.AVG_PACE;
    const paceAdjustment = matchPace ? Math.max(-6, (matchPace - avgPace) * 0.5) : 0;
    const dynamicFloor = PROJECTION_CONFIG.SCORE_FLOOR_MIN + paceAdjustment; // range: ~86 a 98

    const finalFloorA = Math.max(floorA, dynamicFloor);
    const finalFloorB = Math.max(floorB, dynamicFloor);

    return {
        finalA: Math.max(finalFloorA, Math.min(PROJECTION_CONFIG.SCORE_CEILING_MAX, scoreA)),
        finalB: Math.max(finalFloorB, Math.min(PROJECTION_CONFIG.SCORE_CEILING_MAX, scoreB))
    };
};

export const calculateProjectedScores = (
    teamA: Team,
    teamB: Team,
    options?: PaceOptions & {
        injuriesA?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
        injuriesB?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number }[];
        defenseData?: any[];
    },
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
) => {
    const rtgA = getTeamRatings(teamA, databallrA);
    const rtgB = getTeamRatings(teamB, databallrB);

    const matchPace = calculateDeterministicPace(
        teamA, teamB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB,
        rtgA, rtgB,
        options?.powerA ?? 0, options?.powerB ?? 0,
        options?.defenseData
    );

    let projA = ((rtgA.offRtg + rtgB.defRtg) / 2) * (matchPace / 100);
    let projB = ((rtgB.offRtg + rtgA.defRtg) / 2) * (matchPace / 100);

    const context = applyContextualAdjustments(projA, projB, matchPace, options);
    projA = context.adjA; projB = context.adjB;

    const superiority = applySuperiorityFilters(projA, projB, teamA, teamB, rtgA, rtgB, options?.powerA ?? 0, options?.powerB ?? 0);
    projA = superiority.adjA; projB = superiority.adjB;

    const volatility = applyVolatilityFilter(projA, projB, databallrA, databallrB, options?.powerA, options?.powerB);
    projA = volatility.adjA; projB = volatility.adjB;

    const homeAdv = PROJECTION_CONFIG.HOME_ADVANTAGE;
    if (options?.isHomeA) { projA += homeAdv; projB -= homeAdv; }
    else { projB += homeAdv; projA -= homeAdv; }

    projA -= calculatePenalty(options?.injuriesA);
    projB -= calculatePenalty(options?.injuriesB);

    const { finalA, finalB } = clampScores(projA, projB, rtgA.seasonPPG - 30, rtgB.seasonPPG - 30, matchPace);

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
// UTILITÁRIOS E PARSERS (COMPATIBILIDADE SISTÊMICA)
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
        // [V5.1] Preenchimento com alternância (estabilidade de projeção conforme testes)
        while (results.length < 5) {
            const first = results[0];
            if (first) {
                results.unshift(first === 'V' ? 'D' : 'V');
            } else {
                break;
            }
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
    if (!d || !m || !y) return { yesterday: false, tomorrow: false };
    const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const yesterday = new Date(current);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];
    const playedYesterday = dbPredictions.some(p => (p.home_team.toLowerCase().includes(teamName.toLowerCase()) || p.away_team.toLowerCase().includes(teamName.toLowerCase())) && p.date === yStr);
    const playsTomorrow = dbPredictions.some(p => (p.home_team.toLowerCase().includes(teamName.toLowerCase()) || p.away_team.toLowerCase().includes(teamName.toLowerCase())) && p.date === tStr);
    return { yesterday: playedYesterday, tomorrow: playsTomorrow };
};

export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0] || '0', 10);
    const pts2 = parseInt(parts[1] || '0', 10);
    return isNaN(pts1) || isNaN(pts2) ? 0 : pts1 + pts2;
};

export const calculateMatchupPaceV2 = (teamA: Team, teamB: Team, h2hFromDefense?: any[]) => {
    const PACE_FACTOR = SEASON_25_26_METRICS.AVG_ORTG / 100;
    const getGamePace = (score: string) => parseScoreToTotal(score) / (2 * PACE_FACTOR);

    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0 ? last5A.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5A.length : 0;
    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0 ? last5B.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5B.length : 0;

    const normB = normalizeTeamName(teamB.name);
    // Prioriza h2hFromDefense (defense_data do Supabase) se disponível
    let h2hGames = h2hFromDefense && h2hFromDefense.length > 0 ? h2hFromDefense : [];

    // Fallback para o histórico embutido no Team (menos confiável/granular)
    if (h2hGames.length === 0) {
        h2hGames = (teamA.record || []).filter(g => g.opponent && normalizeTeamName(g.opponent).includes(normB)).slice(-2);
    }

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
    const defA = Number(teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 115);
    if (defA < 109.5) rules.push('Defesa_Forte');
    if (analysis.totalPayload < 210) rules.push('Total_Baixo');
    if (Math.abs(edge) >= 4.5) rules.push('Value_Bet');

    // [V5.1] Cálculo de Kelly Simplificado (assumindo odd média ~1.91 / -110)
    const kelly = Math.max(0, (edge * 1.5) / 100); // Alocação sugerida baseada na borda
    const levels = {
        home: isUnderdogA ? Number(edge) : 0,
        away: !isUnderdogA ? Number(edge) : 0
    };

    return {
        hasValue: rules.length >= 2,
        rules,
        edge: Number(edge).toFixed(1),
        levels,
        kelly: Number(kelly.toFixed(3))
    };
};
