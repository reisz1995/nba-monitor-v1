import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean | undefined;
    isB2BA?: boolean | undefined;
    isB2BB?: boolean | undefined;
    isPlayoff?: boolean | undefined;
    seriesGames?: any[] | undefined;
    lastMarginA?: number | undefined;
    lastMarginB?: number | undefined;
    powerA?: number | undefined;
    powerB?: number | undefined;
    editorInsight?: string | undefined;
    seriesScore?: string | undefined;
    gameNumber?: number;  // [V5.6] NOVO: número do jogo na série
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
    bench_net_rating?: number | undefined;  // [V5.6] NOVO: Net Rating do banco
    bench_depth_score?: number | undefined;  // [V5.6] NOVO: Score de profundidade do banco (0-10)
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD DE CONFIGURAÇÃO - KERNEL V5.6 (Correções Críticas + Fator Resiliência)
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
    // [V5.6] Elimination Game Psychology - DETECÇÃO FIXADA
    ELIMINATION_UNDERDOG_BOOST: 1.045,
    ELIMINATION_FAVORITE_NERF: 0.955,
    // Close Series Boost
    CLOSE_SERIES_HOME_BOOST: 1.03,
    CLOSE_SERIES_AWAY_NERF: 0.97,
    // Bench Depth Penalty
    BENCH_DEPTH_PENALTY_PER_PLAYER: 1.5,
    BENCH_DEPTH_THRESHOLD: 2,
    // Momentum Playoff Multiplier 3x
    MOMENTUM_PLAYOFF_MULTIPLIER: 3.0,
    MOMENTUM_BASE_IMPACT: 0.3,
    // Calibração Lesão
    STAR_INJURY_MAX_IMPACT: 15.0,
    STAR_INJURY_HW_MULTIPLIER: 1.3,
    SYSTEMIC_COLLAPSE_PENALTY: 0.90,
    // [V5.6] NOVO: Fator de Resiliência
    RESILIENCE_DEFENSE_THRESHOLD: 110.0,  // DRTG < 110 = defesa forte
    RESILIENCE_BENCH_NET_THRESHOLD: 2.0,  // Bench NET > 2.0 = banco produtivo
    RESILIENCE_MAX_BUFF: 12.0,            // Máximo de buff em pts
    // Floor Dinâmico
    FLOOR_STAR_DTD_MULTIPLIER: 0.88,
    FLOOR_STAR_OUT_MULTIPLIER: 0.82,
    FLOOR_MULTIPLE_OUT_MULTIPLIER: 0.88,
    FLOOR_DEFAULT_MULTIPLIER: 0.92,
    // [V5.6] Floor com momentum negativo
    FLOOR_MOMENTUM_PENALTY: 0.90,         // Se momentum < -30, floor extra -10%
    // Blowout Detection
    BLOWOUT_MARGIN_THRESHOLD: 15,
    BLOWOUT_BOOST_WINNER: 1.04,
    BLOWOUT_NERF_LOSER: 0.96,
    BLOWOUT_H2H_LOOKBACK: 3,
    // [V5.6] H2H Pace Weight Dinâmico - USAR ÚLTIMOS 2
    H2H_LOW_SCORE_THRESHOLD: 210,         // [V5.6] Reduzido de 190 para 210
    H2H_LOW_SCORE_WEIGHT: 0.20,           // [V5.6] Reduzido de 0.30 para 0.20
    H2H_NORMAL_SCORE_WEIGHT: 0.50,
    // [V5.6] Playoff Reducer Dinâmico
    PLAYOFF_REDUCER_BASE_STATIC: 0.94,
    PLAYOFF_REDUCER_BASE_SLOW: 0.97,
    PLAYOFF_REDUCER_ELIMINATION: 0.03,    // -3% extra em eliminação
    PLAYOFF_REDUCER_MOMENTUM: 0.02,       // -2% extra se momentum < -20
    PLAYOFF_REDUCER_GAME6: 0.02,          // -2% extra no Game 6+
    PLAYOFF_REDUCER_MIN: 0.88,            // Piso do reducer: máximo de -12% de penalização
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

// [V5.6] Momentum com DERROTAS PENALIZANDO
const calculateMomentumImpact = (record: any[], isPlayoff: boolean = false): number => {
    const momentumScore = record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null && 'result' in res ? (res as any).result : res;
        const weight = Math.pow(2, idx);
        if (rStr === 'V') return score + weight;
        if (rStr === 'D') return score - weight;  // [V5.6] DERROTAS AGORA PENALIZAM!
        return score;
    }, 0);
    const normalizedMomentum = (momentumScore / 31) * 50;  // Normalizar para -50 a +50
    const multiplier = isPlayoff ? PROJECTION_CONFIG.MOMENTUM_PLAYOFF_MULTIPLIER : 1.0;
    return normalizedMomentum * PROJECTION_CONFIG.MOMENTUM_BASE_IMPACT * multiplier;
};

// [V5.6] Blowout Detection - CORRIGIDO para identificar time correto
const detectBlowoutTrend = (
    h2hGames?: any[], 
    teamAName?: string, 
    teamBName?: string
): { hasBlowout: boolean; winner: 'A' | 'B' | null; margin: number } => {
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
        const ptsHome = parseInt(parts[0]);
        const ptsAway = parseInt(parts[1]);
        const margin = Math.abs(ptsHome - ptsAway);

        if (margin >= PROJECTION_CONFIG.BLOWOUT_MARGIN_THRESHOLD) {
            blowoutCount++;
            if (margin > maxMargin) {
                maxMargin = margin;
                // [V5.6] Identificar corretamente quem venceu baseado nos nomes dos times
                const homeTeam = game.home_team || '';
                const awayTeam = game.away_team || '';
                const winnerIsHome = ptsHome > ptsAway;
                
                // Mapear para Team A ou Team B
                if (teamAName && teamBName) {
                    const teamAKey = teamAName.toLowerCase().split(' ').pop() || '';
                    const teamBKey = teamBName.toLowerCase().split(' ').pop() || '';
                    const homeKey = homeTeam.toLowerCase().split(' ').pop() || '';

                    if (homeKey !== teamAKey && homeKey !== teamBKey) {
                        console.warn(`[detectBlowoutTrend] Matching ambíguo: homeTeam="${homeTeam}" não bate com "${teamAName}" nem "${teamBName}". Fallback aplicado.`);
                    }
                    
                    if (winnerIsHome) {
                        blowoutWinner = homeKey === teamAKey ? 'A' : 'B';
                    } else {
                        blowoutWinner = homeKey === teamAKey ? 'B' : 'A';
                    }
                } else {
                    // Fallback se nomes não disponíveis
                    blowoutWinner = winnerIsHome ? 'A' : 'B';
                }
            }
        }
    });

    return {
        hasBlowout: blowoutCount >= 2,
        winner: blowoutCount >= 2 ? blowoutWinner : null,
        margin: maxMargin
    };
};

// [V5.5] Playoff Series Trend - detecta se série está sendo "grindada"
const detectPlayoffSeriesTrend = (seriesGames?: any[]): { isGrind: boolean; avgTotal: number; gameCount: number } => {
    if (!seriesGames || seriesGames.length < 3) return { isGrind: false, avgTotal: 0, gameCount: 0 };
    const totals = seriesGames.map(g => parseScoreToTotal(g.score)).filter(t => t > 0);
    if (totals.length === 0) return { isGrind: false, avgTotal: 0, gameCount: 0 };
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { isGrind: avg < 205, avgTotal: avg, gameCount: totals.length };
};

// [V5.6] NOVO: Fator de Resiliência
const calculateResilienceBuff = (
    team: Team,
    databallr?: DataballrInput | null,
    injuries?: { isOut: boolean; weight: number }[],
    isHome?: boolean
): { buff: number; razoes: string[] } => {
    let buff = 0;
    const razoes: string[] = [];
    
    // Verificar se estrela HW>=9 está OUT
    const starOut = (injuries || []).find(i => i.isOut && i.weight >= 9);
    if (!starOut) return { buff: 0, razoes: [] };
    
    // Condição 1: Defesa forte (DRTG < 110)
    const defRtg = databallr?.drtg || (team.stats?.media_pontos_defesa || 115);
    const hasStrongDefense = defRtg < PROJECTION_CONFIG.RESILIENCE_DEFENSE_THRESHOLD;
    
    // Condição 2: Jogando em casa
    const isHomeGame = isHome === true;
    
    // Condição 3: Banco produtivo (bench_net_rating > 2.0 ou bench_depth_score > 6)
    const hasGoodBench = (databallr?.bench_net_rating || 0) > PROJECTION_CONFIG.RESILIENCE_BENCH_NET_THRESHOLD ||
                         (databallr?.bench_depth_score || 0) > 6;
    
    // Calcular buff
    if (hasStrongDefense) {
        buff += 4;
        razoes.push(`Defesa forte (DRTG ${defRtg.toFixed(1)}) sem estrela = organização defensiva compensa`);
    }
    
    if (isHomeGame) {
        buff += 3;
        razoes.push("Jogo em casa sem estrela = energia da torcida + papel de herói para role players");
    }
    
    if (hasGoodBench) {
        buff += 3;
        razoes.push(`Banco produtivo (NET ${databallr?.bench_net_rating || 'N/D'}) = minutos de qualidade`);
    }
    
    // Buff máximo
    buff = Math.min(buff, PROJECTION_CONFIG.RESILIENCE_MAX_BUFF);
    
    if (buff > 0) {
        razoes.unshift(`FATOR RESILIÊNCIA: +${buff.toFixed(1)} pts (estrela ${starOut.weight} OUT, mas time estruturado)`);
    }
    
    return { buff, razoes };
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSISTEMA DE PACE - [V5.6] CORREÇÕES H2H + DETECÇÃO ELIMINAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
export const calculateDeterministicPace = (
    teamA: Team, teamB: Team,
    databallrA?: DataballrInput | null, databallrB?: DataballrInput | null,
    injuriesA?: { isOut: boolean; weight: number }[], injuriesB?: { isOut: boolean; weight: number }[],
    rtgA?: { defRtg: number }, rtgB?: { defRtg: number },
    powerA: number = 0, powerB: number = 0,
    h2hFromDefense?: any[], isPlayoff: boolean = false, editorInsight?: string,
    seriesGames?: any[]
): { pace: number; h2hWeightUsed: number } => {
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

    // [V5.6] H2H Pace com weight dinâmico + fallback para seriesGames
    let avgPaceH2H = 0;
    let h2hWeight = PROJECTION_CONFIG.H2H_NORMAL_SCORE_WEIGHT;

    const h2hGames = h2hFromDefense && h2hFromDefense.length > 0 
        ? h2hFromDefense 
        : (seriesGames || []);

    if (h2hGames.length > 0) {
        const h2hTotals = h2hGames.map(g => parseScoreToTotal(g.score)).filter(t => t > 0);
        
        // [V5.6] Usar média dos ÚLTIMOS 2 H2H, não de todos
        const recentH2H = h2hTotals.slice(-2);
        const recentAvg = recentH2H.length > 0 
            ? recentH2H.reduce((a, b) => a + b, 0) / recentH2H.length 
            : 0;

        if (recentAvg > 0 && recentAvg < PROJECTION_CONFIG.H2H_LOW_SCORE_THRESHOLD) {
            h2hWeight = PROJECTION_CONFIG.H2H_LOW_SCORE_WEIGHT;
            if (process.env.NODE_ENV === 'development') {
                console.log(`[SYS-OP] H2H recente atípico (avg ${recentAvg.toFixed(1)}). Peso reduzido para ${h2hWeight}.`);
            }
        }

        avgPaceH2H = h2hGames.reduce((sum, g) => sum + (parseScoreToTotal(g.score) / (2 * PACE_FACTOR)), 0) / h2hGames.length;
    }

    // [V5.5] Se temos trend de série playoff, usar como override parcial
    const seriesTrend = detectPlayoffSeriesTrend(seriesGames);
    if (seriesTrend.isGrind && seriesTrend.gameCount >= 3) {
        h2hWeight = Math.min(h2hWeight, 0.25);
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] Série grind detectada (avg ${seriesTrend.avgTotal.toFixed(1)}). H2H weight: ${h2hWeight}.`);
        }
    }

    let basePace = avgPaceH2H > 0 
        ? (mediaL5 * (1 - h2hWeight)) + (avgPaceH2H * h2hWeight) 
        : mediaL5;

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

    return { pace: projectedPace, h2hWeightUsed: h2hWeight };
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

// [V5.6] Star Injury Impact com DTD penalizado
const calculateStarInjuryImpactV2 = (injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number }[]): number => {
    const starOut = (injuries || []).filter(i => i.isOut && i.weight >= 9);
    const starDtd = (injuries || []).filter(i => i.isDayToDay && i.weight >= 9);
    
    const outImpact = starOut.reduce((total, star) => {
        return total + Math.min(star.weight * PROJECTION_CONFIG.STAR_INJURY_HW_MULTIPLIER, PROJECTION_CONFIG.STAR_INJURY_MAX_IMPACT);
    }, 0);
    
    // [V5.6] DTD = 50% do impacto de OUT
    const dtdImpact = starDtd.reduce((total, star) => {
        return total + (Math.min(star.weight * PROJECTION_CONFIG.STAR_INJURY_HW_MULTIPLIER, PROJECTION_CONFIG.STAR_INJURY_MAX_IMPACT) * 0.5);
    }, 0);
    
    return outImpact + dtdImpact;
};

const applySystemicCollapseV2 = (score: number, injuries?: { isOut: boolean; weight: number }[]): number => {
    const hasCriticalOut = (injuries || []).some(i => i.isOut && i.weight >= 9);
    if (hasCriticalOut) return score * PROJECTION_CONFIG.SYSTEMIC_COLLAPSE_PENALTY;
    return score;
};

// [V5.6] Floor dinâmico com DTD de estrela + momentum negativo
const getDynamicFloor = (
    seasonPPG: number, 
    injuries?: { isOut: boolean; isDayToDay?: boolean; weight: number; playedLastGame?: boolean }[],
    momentum?: number  // [V5.6] NOVO
): number => {
    const hasStarOut = (injuries || []).some(i => i.isOut && i.weight >= 9);
    const hasStarDTD = (injuries || []).some(i => i.isDayToDay && i.weight >= 8);
    const outCount = (injuries || []).filter(i => i.isOut).length;

    let multiplier = PROJECTION_CONFIG.FLOOR_DEFAULT_MULTIPLIER;

    if (hasStarOut) multiplier = PROJECTION_CONFIG.FLOOR_STAR_OUT_MULTIPLIER;
    else if (hasStarDTD) {
        const starDTD = (injuries || []).find(i => i.isDayToDay && i.weight >= 8);
        if (starDTD && (starDTD as any).playedLastGame) {
            multiplier = 0.95;
        } else {
            multiplier = PROJECTION_CONFIG.FLOOR_STAR_DTD_MULTIPLIER;
        }
    }
    
    if (outCount >= PROJECTION_CONFIG.BENCH_DEPTH_THRESHOLD) multiplier = PROJECTION_CONFIG.FLOOR_MULTIPLE_OUT_MULTIPLIER;
    
    // [V5.6] NOVO: Momentum negativo reduz floor extra
    if (momentum !== undefined && momentum < -30) {
        multiplier *= PROJECTION_CONFIG.FLOOR_MOMENTUM_PENALTY;
    }
    
    return seasonPPG * multiplier;
};

const calculateBenchDepthPenalty = (injuries?: { isOut: boolean; weight: number }[]): number => {
    const outPlayers = (injuries || []).filter(i => i.isOut);
    if (outPlayers.length >= PROJECTION_CONFIG.BENCH_DEPTH_THRESHOLD) {
        return (outPlayers.length - PROJECTION_CONFIG.BENCH_DEPTH_THRESHOLD + 1) * PROJECTION_CONFIG.BENCH_DEPTH_PENALTY_PER_PLAYER;
    }
    return 0;
};

export const calculateStarUncertainty = (injuries?: { nome?: string; isOut: boolean; isDayToDay?: boolean; weight: number; playedLastGame?: boolean }[]): { variance: number; note: string; playerName?: string } => {
    const starDTD = (injuries || []).find(i => i.isDayToDay && i.weight >= 8);
    if (starDTD) {
        const playedNote = starDTD.playedLastGame ? ' (jogou último)' : ' (não jogou último)';
        return { 
            variance: starDTD.playedLastGame ? 3.5 : 6.0,
            note: `${starDTD.nome || 'Star'} DTD (HW ${starDTD.weight})${playedNote} - ${starDTD.playedLastGame ? 'moderate' : 'high'} variance game`, 
            playerName: starDTD.nome 
        };
    }
    return { variance: 0, note: '' };
};

// ─────────────────────────────────────────────────────────────────────────────
// KERNEL DE PROJEÇÃO - [V5.6] CORREÇÕES CRÍTICAS
// ─────────────────────────────────────────────────────────────────────────────
const applyContextualAdjustments = (scoreA: number, scoreB: number, matchPace: number, options?: PaceOptions) => {
    let adjA = scoreA, adjB = scoreB;
    if (options?.isB2BA) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.isB2BB) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginA && options.lastMarginA > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjA -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;
    if (options?.lastMarginB && options.lastMarginB > PROJECTION_CONFIG.LAST_MARGIN_THRESHOLD) adjB -= PROJECTION_CONFIG.LAST_MARGIN_PENALTY;

    if (options?.editorInsight) {
        if (options.editorInsight.match(/🎯 NOSSA APOSTA:\\s*OVER/i)) {
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

const isCloseSeriesGame = (seriesScore?: string): { isClose: boolean; leader: 'A' | 'B' | null } => {
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

// [V5.6] DETECÇÃO DE ELIMINAÇÃO FIXADA
const detectEliminationGame = (
    seriesScore?: string, 
    gameNumber?: number,
    isPlayoff?: boolean
): boolean => {
    if (!isPlayoff) return false;
    
    // Game 6 ou 7 sempre = eliminação
    if (gameNumber && gameNumber >= 6) return true;
    
    // Placar 3-2, 3-1, 3-0 = eliminação possível
    if (seriesScore) {
        const match = seriesScore.match(/(\d+)-(\d+)/);
        if (match) {
            const [_, winsA, winsB] = match.map(Number);
            if (winsA === 3 || winsB === 3) return true;
        }
    }
    
    return false;
};

export const calculateProjectedScores = (
    teamA: Team, teamB: Team,
    options?: PaceOptions & {
        injuriesA?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number; playedLastGame?: boolean }[];
        injuriesB?: { nome: string; isOut: boolean; isDayToDay?: boolean; weight: number; playedLastGame?: boolean }[];
        defenseData?: any[];
        seriesGames?: any[];
    },
    databallrA?: DataballrInput | null, databallrB?: DataballrInput | null
) => {
    // [V5.6] Priorizar flag explícita, fallback para regex no editorInsight
    const isPlayoff = options?.isPlayoff ?? !!options?.editorInsight?.match(/playoff|pós-temporada|round \\d|game \\d|série/i);
    const powerDiffWeight = isPlayoff ? 0.95 : PROJECTION_CONFIG.POWER_DIFF_WEIGHT;

    const rtgA = getTeamRatings(teamA, databallrA);
    const rtgB = getTeamRatings(teamB, databallrB);

    const { pace: matchPace, h2hWeightUsed: h2hWeightFromPace } = calculateDeterministicPace(
        teamA, teamB, databallrA, databallrB,
        options?.injuriesA, options?.injuriesB,
        rtgA, rtgB, options?.powerA ?? 0, options?.powerB ?? 0,
        options?.defenseData, isPlayoff, options?.editorInsight,
        options?.seriesGames
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

    // [V5.6] Elimination Game Psychology - DETECÇÃO FIXADA
    const isEliminationGame = detectEliminationGame(options?.seriesScore, options?.gameNumber, isPlayoff);
    
    if (isEliminationGame && isPlayoff) {
        const isUnderdogA = (options?.powerA ?? 0) < (options?.powerB ?? 0);
        if (isUnderdogA) {
            projA *= PROJECTION_CONFIG.ELIMINATION_UNDERDOG_BOOST;
            projB *= PROJECTION_CONFIG.ELIMINATION_FAVORITE_NERF;
        } else {
            projB *= PROJECTION_CONFIG.ELIMINATION_UNDERDOG_BOOST;
            projA *= PROJECTION_CONFIG.ELIMINATION_FAVORITE_NERF;
        }
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] ELIMINATION GAME (Game ${options?.gameNumber}, Score ${options?.seriesScore}): Underdog +4.5%, Favorite -4.5%`);
        }
    }

    // Close Series
    const closeSeries = isCloseSeriesGame(options?.seriesScore);
    if (closeSeries.isClose && isPlayoff) {
        if (closeSeries.leader === 'A' && options?.isHomeA) {
            projA *= PROJECTION_CONFIG.CLOSE_SERIES_HOME_BOOST;
            projB *= PROJECTION_CONFIG.CLOSE_SERIES_AWAY_NERF;
        } else if (closeSeries.leader === 'B' && !options?.isHomeA) {
            projB *= PROJECTION_CONFIG.CLOSE_SERIES_HOME_BOOST;
            projA *= PROJECTION_CONFIG.CLOSE_SERIES_AWAY_NERF;
        }
    }

    // [V5.6] Blowout Detection - CORRIGIDO com nomes dos times
    const blowoutTrend = detectBlowoutTrend(options?.defenseData, teamA.name, teamB.name);
    if (blowoutTrend.hasBlowout && isPlayoff) {
        if (blowoutTrend.winner === 'A') {
            projA *= PROJECTION_CONFIG.BLOWOUT_BOOST_WINNER;
            projB *= PROJECTION_CONFIG.BLOWOUT_NERF_LOSER;
            if (process.env.NODE_ENV === 'development') console.log(`[SYS-OP] BLOWOUT TREND: ${teamA.name} winner (+4%), ${teamB.name} loser (-4%)`);
        } else if (blowoutTrend.winner === 'B') {
            projB *= PROJECTION_CONFIG.BLOWOUT_BOOST_WINNER;
            projA *= PROJECTION_CONFIG.BLOWOUT_NERF_LOSER;
            if (process.env.NODE_ENV === 'development') console.log(`[SYS-OP] BLOWOUT TREND: ${teamB.name} winner (+4%), ${teamA.name} loser (-4%)`);
        }
    }

    // Momentum Playoff: aplicado exclusivamente via getDynamicFloor (floor dinâmico).
    // Não adicionamos diretamente ao score para evitar double-counting com a penalização do floor.

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

    // [V5.6] NOVO: Fator de Resiliência
    const resilienceA = calculateResilienceBuff(teamA, databallrA, options?.injuriesA, options?.isHomeA);
    const resilienceB = calculateResilienceBuff(teamB, databallrB, options?.injuriesB, !options?.isHomeA);
    
    if (resilienceA.buff > 0) {
        projA += resilienceA.buff;
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] RESILIÊNCIA ${teamA.name}: +${resilienceA.buff.toFixed(1)} pts`);
        }
    }
    if (resilienceB.buff > 0) {
        projB += resilienceB.buff;
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] RESILIÊNCIA ${teamB.name}: +${resilienceB.buff.toFixed(1)} pts`);
        }
    }

    // [V5.6] Floor dinâmico com momentum
    const momentumA = isPlayoff ? calculateMomentumImpact(teamA.record || [], true) : 0;
    const momentumB = isPlayoff ? calculateMomentumImpact(teamB.record || [], true) : 0;
    
    const floorA = getDynamicFloor(rtgA.seasonPPG, options?.injuriesA, momentumA);
    const floorB = getDynamicFloor(rtgB.seasonPPG, options?.injuriesB, momentumB);

    const { finalA, finalB } = clampScores(projA, projB, floorA, floorB, isPlayoff);

    let totalPayload = finalA + finalB;
    const kineticState = matchPace > 105.5 ? 'HYPER_KINETIC' : (matchPace < 97.5 ? 'SLOW_GRIND' : 'STATIC_TRENCH');

    // [V5.6] Playoff Reducer DINÂMICO
    if (isPlayoff) {
        let reducer = kineticState === 'STATIC_TRENCH' 
            ? PROJECTION_CONFIG.PLAYOFF_REDUCER_BASE_STATIC 
            : PROJECTION_CONFIG.PLAYOFF_REDUCER_BASE_SLOW;
        
        // Aplicar reduções extras
        if (isEliminationGame) reducer -= PROJECTION_CONFIG.PLAYOFF_REDUCER_ELIMINATION;
        
        if (momentumA < -20 || momentumB < -20) reducer -= PROJECTION_CONFIG.PLAYOFF_REDUCER_MOMENTUM;
        
        if (options?.gameNumber && options.gameNumber >= 6) reducer -= PROJECTION_CONFIG.PLAYOFF_REDUCER_GAME6;
        
        // Garantir piso do reducer
        reducer = Math.max(reducer, PROJECTION_CONFIG.PLAYOFF_REDUCER_MIN);
        
        totalPayload *= reducer;
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`[SYS-OP] Playoff reducer dinâmico: ${(reducer * 100).toFixed(1)}% (${kineticState})`);
        }
    }

    const uncertaintyA = calculateStarUncertainty(options?.injuriesA);
    const uncertaintyB = calculateStarUncertainty(options?.injuriesB);

    // [V5.5] Adicionar seriesTrend ao retorno
    const seriesTrend = detectPlayoffSeriesTrend(options?.seriesGames);

    return {
        matchPace, totalPayload, deltaA: finalA, deltaB: finalB, kineticState,
        databallrEnhanced: !!(databallrA?.ortg && databallrB?.ortg), isPlayoff,
        uncertaintyVariance: Math.max(uncertaintyA.variance, uncertaintyB.variance),
        uncertaintyNote: uncertaintyA.note || uncertaintyB.note || '',
        isCloseSeries: closeSeries.isClose, seriesLeader: closeSeries.leader,
        benchPenaltyA, benchPenaltyB,
        momentumA, momentumB,
        floorA, floorB,
        starPenaltyA: calculateStarInjuryImpactV2(options?.injuriesA),
        starPenaltyB: calculateStarInjuryImpactV2(options?.injuriesB),
        blowoutDetected: blowoutTrend.hasBlowout,
        blowoutWinner: blowoutTrend.winner,
        h2hWeightUsed: h2hWeightFromPace,
        seriesTrendGrind: seriesTrend.isGrind,
        seriesAvgTotal: seriesTrend.avgTotal,
        eliminationApplied: isEliminationGame,
        // [V5.6] NOVOS CAMPOS
        resilienceBuffA: resilienceA.buff,
        resilienceBuffB: resilienceB.buff,
        resilienceRazoesA: resilienceA.razoes,
        resilienceRazoesB: resilienceB.razoes,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────
// NOTA: comportamento V5.6 — derrotas penalizam (pesos exponenciais negativos).
// Retorna score bruto não-normalizado. Para impacto em pontos, use calculateMomentumImpact.
export const getMomentumScore = (record: any[]): number => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null && 'result' in res ? (res as any).result : res;
        const weight = Math.pow(2, idx);
        if (rStr === 'V') return score + weight;
        if (rStr === 'D') return score - weight;
        return score;
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
