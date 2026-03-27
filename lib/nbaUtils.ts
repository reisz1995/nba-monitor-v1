
import { GameResult, Team, GameRecordData } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number; // Margin of last game (+ for win, - for loss)
    lastMarginB?: number;
}

/**
 * Input de métricas avançadas do Databallr (últimos 14 dias).
 * Todas as props são opcionais — quando ausentes, o motor usa fallback ESPN/PPG.
 */
export interface DataballrInput {
    /** Offensive Rating: pontos marcados por 100 posses */
    ortg?: number;
    /** Defensive Rating: pontos sofridos por 100 posses */
    drtg?: number;
    /** Posses por 48 minutos (pode ser nulo se pipeline não preencheu) */
    pace?: number | null;
    /** True Shooting % × 100 */
    o_ts?: number;
    /** Turnover Ratio (% de posses que terminam em erro) */
    o_tov?: number;
    /** Offensive Rebound % */
    orb?: number;
    /** Defensive Rebound % */
    drb?: number;
    /** Net Rating = ortg - drtg */
    net_rating?: number;
    /** Ataque relativo à média da liga */
    offense_rating?: number;
    /** Defesa relativa à média da liga */
    defense_rating?: number;
}

// Liga NBA 2025-26: valores de referência para normalização
const LEAGUE_AVG_ORTG = 115.5;
const LEAGUE_AVG_PACE = 99.7;
const LEAGUE_AVG_TOV = 14.8;

/**
 * ALGORITMO DE RITMO E COLISÃO ESTATÍSTICA v3.0 (DATABALLR_ENHANCED)
 *
 * Quando stats do Databallr estiverem disponíveis, usa ORTG/DRTG reais como base
 * de eficiência cruzada, calculando posses por 48min como proxy de pace.
 * Fallback automático para PPG ESPN quando dados estiverem ausentes.
 */

// Sub-rotina de estabilização: Mescla a temporada completa com os últimos 14 dias
const getFallbackPace = (team: Team): number => {
    const offRtg = team.espnData?.pts || team.stats?.media_pontos_ataque || 115.5;
    return offRtg / (LEAGUE_AVG_ORTG / 100);
};

const getBlendedPace = (team: Team, databallr?: DataballrInput | null): number => {
    // 1. Captura a âncora macro (Temporada)
    // Assuma que 'team.pace' ou sua função de fallback retorna o Pace da ESPN
    const seasonPace = team.pace || getFallbackPace(team);

    // 2. Captura a âncora micro (14 Dias)
    const recentPace = databallr?.pace;

    // 3. Executa a média aritmética se ambos os vetores existirem
    if (recentPace && recentPace > 0) {
        return (seasonPace + recentPace) / 2;
    }

    // Fallback de segurança: Se o Databallr falhar, retorna apenas a temporada
    return seasonPace;
};

export const calculateDeterministicPace = (
    teamA: Team,
    teamB: Team,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
): number => {
    // 1. Extração da Identidade Híbrida de cada equipe
    const blendedPaceA = getBlendedPace(teamA, databallrA);
    const blendedPaceB = getBlendedPace(teamB, databallrB);

    // 2. Fusão Termodinâmica do Confronto
    let projectedPace = (blendedPaceA + blendedPaceB) / 2;

    // 3. Grampo Térmico (Clamp) - Limites da Realidade Física da NBA
    const MIN_PACE = 90.0;  // Jogo extremamente lento/truncado
    const MAX_PACE = 105.0; // Jogo em transição frenética

    const clampedPace = Math.max(MIN_PACE, Math.min(MAX_PACE, projectedPace));

    console.log(`[SYS-OP] Híbrido A: ${blendedPaceA.toFixed(1)} | Híbrido B: ${blendedPaceB.toFixed(1)}`);
    console.log(`[SYS-OP] Pace Projetado (Clamped): ${clampedPace.toFixed(2)}`);

    return clampedPace;
};

export const calculateProjectedScores = (
    entityA: Team,
    entityB: Team,
    options?: PaceOptions,
    databallrA?: DataballrInput | null,
    databallrB?: DataballrInput | null
) => {
    const hasDataballr = !!(databallrA?.ortg && databallrB?.ortg);

    // ─── FONTE DE RATINGS ────────────────────────────────────────────────────
    // V3.0: usa ORTG/DRTG quando disponível, caso contrário PPG ESPN
    const offRtgA = hasDataballr ? databallrA!.ortg! : (entityA.espnData?.pts || entityA.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    const defRtgA = hasDataballr ? databallrA!.drtg! : (entityA.espnData?.pts_contra || entityA.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);
    const offRtgB = hasDataballr ? databallrB!.ortg! : (entityB.espnData?.pts || entityB.stats?.media_pontos_ataque || LEAGUE_AVG_ORTG);
    const defRtgB = hasDataballr ? databallrB!.drtg! : (entityB.espnData?.pts_contra || entityB.stats?.media_pontos_defesa || LEAGUE_AVG_ORTG);

    // ─── CÁLCULO DO PACE ─────────────────────────────────────────────────────
    const matchPace = calculateDeterministicPace(entityA, entityB, databallrA, databallrB);

    // ─── CÁLCULO DO PLACAR PROJETADO ─────────────────────────────────────────
    // Eficiência cruzada: (Ataque do Time) vs (Defesa do Oponente)
    let projectedScoreA: number;
    let projectedScoreB: number;

    if (hasDataballr) {
        // V3.0: usa ORTG real → converte em pontos esperados via pace
        // Fórmula: pontos = (ORTG / 100) × pace
        // Mas moderamos com a defesa do adversário para cruzamento real
        const effA = (offRtgA + defRtgB) / 2; // eficiência cruzada corrigida
        const effB = (offRtgB + defRtgA) / 2;
        projectedScoreA = (effA / 100) * matchPace;
        projectedScoreB = (effB / 100) * matchPace;

        // Ajuste de qualidade de posse via True Shooting % (TS%)
        // TS% acima de 58% dá bônus; abaixo penaliza levemente
        const tsAvgLeague = 58.0;
        if (databallrA!.o_ts) {
            const tsBonusA = (databallrA!.o_ts - tsAvgLeague) * 0.15;
            projectedScoreA += tsBonusA;
        }
        if (databallrB!.o_ts) {
            const tsBonusB = (databallrB!.o_ts - tsAvgLeague) * 0.15;
            projectedScoreB += tsBonusB;
        }

        // Penalidade por turnover acima da média da liga (~14.8%)
        if (databallrA!.o_tov && databallrA!.o_tov > LEAGUE_AVG_TOV) {
            projectedScoreA -= (databallrA!.o_tov - LEAGUE_AVG_TOV) * 0.3;
        }
        if (databallrB!.o_tov && databallrB!.o_tov > LEAGUE_AVG_TOV) {
            projectedScoreB -= (databallrB!.o_tov - LEAGUE_AVG_TOV) * 0.3;
        }

        // Bônus de rebote ofensivo (segunda chance): OReb% acima de 26% gera possibilidade extra
        if (databallrA!.orb && databallrA!.orb > 26) {
            projectedScoreA += (databallrA!.orb - 26) * 0.2;
        }
        if (databallrB!.orb && databallrB!.orb > 26) {
            projectedScoreB += (databallrB!.orb - 26) * 0.2;
        }
    } else {
        // Fallback original
        projectedScoreA = ((offRtgA + defRtgB) / 2.0) * (matchPace / 100.0);
        projectedScoreB = ((offRtgB + defRtgA) / 2.0) * (matchPace / 100.0);
    }

    // ─── AJUSTES SITUACIONAIS ─────────────────────────────────────────────────

    // 1. Vantagem de quadra (+1.5 pts base para o time da casa)
    if (options?.isHomeA) {
        projectedScoreA += 1.5;
        projectedScoreB -= 1.5;
    } else {
        projectedScoreB += 1.5;
        projectedScoreA -= 1.5;
    }

    // 2. Fadiga Back-to-Back (~2.0 pts de queda)
    if (options?.isB2BA) projectedScoreA -= 2.0;
    if (options?.isB2BB) projectedScoreB -= 2.0;

    // 3. Regressão pós-blowout (vitória anterior >20 pts)
    if (options?.lastMarginA && options.lastMarginA > 20) projectedScoreA -= 1.5;
    if (options?.lastMarginB && options.lastMarginB > 20) projectedScoreB -= 1.5;

    // 4. Jogo lento: comprime a vantagem do favorito em 2%
    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        const adjustment = spread * 0.02;
        projectedScoreA -= adjustment / 2;
        projectedScoreB += adjustment / 2;
    }

    const totalPayload = projectedScoreA + projectedScoreB;

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > 102.5 ? 'HYPER_KINETIC' : (matchPace < 98 ? 'SLOW_GRIND' : 'STATIC_TRENCH'),
        databallrEnhanced: hasDataballr,
    };
};

/**
 * Calculates a momentum score based on the weighted recent results.
 * Wins later in the sequence (more recent) have higher weights.
 */
export const getMomentumScore = (record: GameResult[]) => {
    return record.reduce((score, res, idx) => {
        const rStr = typeof res === 'object' && res !== null ? (res as any).result : res;
        return score + (rStr === 'V' ? Math.pow(2, idx) : 0);
    }, 0);
};

/**
 * Parses an ESPN streak string (e.g., 'W4' or 'V-V-D-V-D') into a GameResult array of length 5.
 */
export const parseStreakToRecord = (streakStr: string): GameResult[] | null => {
    if (!streakStr) return null;

    // Handle 'W4' or 'L3' format
    const match = streakStr.match(/([WLVD])(\d+)/i);
    if (match) {
        const type = match[1].toUpperCase();
        const count = Math.min(parseInt(match[2], 10), 5);
        const winChar = (type === 'W' || type === 'V') ? 'V' : 'D';
        const lossChar = winChar === 'V' ? 'D' : 'V';
        const record: GameResult[] = new Array(5).fill(lossChar);
        for (let i = 0; i < count; i++) {
            record[4 - i] = winChar;
        }
        return record;
    }

    // Handle 'V-V-D-V-D' format
    const chars = streakStr.match(/[VDWL]/g);
    if (chars && chars.length > 0) {
        let results = chars.map(c => (c === 'W' || c === 'V' ? 'V' : 'D')) as GameResult[];
        if (results.length > 5) results = results.slice(-5);
        while (results.length < 5) results.unshift(results[0] === 'V' ? 'D' : 'V');
        return results;
    }

    return null;
};

/**
 * Retorna a data formatada como DD/MM/YYYY.
 */
export const getFormattedDate = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

/**
 * Calcula o peso do jogador baseado nos pontos.
 */
export const getPlayerWeight = (pts: number): number => Math.floor((pts || 0) / 3);

/**
 * Encontra um time na lista pelo nome (busca flexível).
 */
export const findTeamByName = (name: string, teams: any[]): any | null => {
    if (!name) return null;
    const clean = normalizeTeamName(name);
    return teams.find(t =>
        normalizeTeamName(t.name) === clean ||
        normalizeTeamName(t.name).includes(clean) ||
        clean.includes(normalizeTeamName(t.name))
    );
};

/**
 * Normaliza o nome do time (remove acentos e espaços extras).
 */
export const normalizeTeamName = (name: string): string => {
    if (!name) return '';
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

/**
 * Verifica se um time jogou ontem ou jogará amanhã (Back-to-Back).
 */
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

/**
 * ALGORITMO DE VALOR DE UNDERDOG RESTRITO
 * Identifica se o confronto possui valor em Underdog baseado em regras endurecidas.
 */
export const calculateUnderdogValue = (teamA: Team, teamB: Team, analysis: any, marketSpread: number | null) => {
    if (marketSpread === null) return null;

    const rules = [];
    const isUnderdogA = marketSpread > 0; // Se spread > 0 para o time da casa (A), ele é underdog
    const fairSpread = analysis.deltaB - analysis.deltaA;
    const edge = marketSpread - fairSpread;

    // Regra: Underdog_Casa
    if (isUnderdogA) rules.push('Underdog_Casa');

    // Vector 2: Endurecimento de Gatilhos
    // Defesa de Elite (apenas times permitindo < 109.5 pts ativam a vantagem de underdog defensivo)
    const defA = teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 115;
    if (defA < 109.5) rules.push('Defesa_Forte');

    // Total sufocado para evitar inflações estatísticas
    if (analysis.totalPayload < 210) rules.push('Total_Baixo');

    // Vector 3: Exigência Matemática Bruta (A borda necessária salta de 3 para 4.5 pts)
    if (Math.abs(edge) >= 4.5) rules.push('Value_Bet');

    return {
        hasValue: rules.length >= 2,
        rules,
        edge: edge.toFixed(1)
    };
};

/**
 * Converte uma string de score "112-105" no total de pontos (217).
 */
export const parseScoreToTotal = (score: string): number => {
    if (!score) return 0;
    const parts = score.split(/[-\s:]+/);
    if (parts.length < 2) return 0;
    const pts1 = parseInt(parts[0], 10);
    const pts2 = parseInt(parts[1], 10);
    if (isNaN(pts1) || isNaN(pts2)) return 0;
    return pts1 + pts2;
};

/**
 * ALGORITMO PACE V2: Ritmo de Confronto baseado em histórico recente.
 * Calcula o ritmo médio dos últimos 5 jogos de cada time e dos últimos 2 H2H.
 */
export const calculateMatchupPaceV2 = (teamA: Team, teamB: Team) => {
    const PACE_FACTOR = LEAGUE_AVG_ORTG / 100;

    const getGamePace = (score: string) => parseScoreToTotal(score) / (2 * PACE_FACTOR);

    // 1. Média do Pace nos últimos 5 jogos do Time A
    const last5A = (teamA.record || []).slice(-5);
    const avgPace5A = last5A.length > 0
        ? last5A.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5A.length
        : 0;

    // 2. Média do Pace nos últimos 5 jogos do Time B
    const last5B = (teamB.record || []).slice(-5);
    const avgPace5B = last5B.length > 0
        ? last5B.reduce((sum, g) => sum + getGamePace(g.score), 0) / last5B.length
        : 0;

    // 3. Média dos últimos 2 H2H (Confrontos Diretos)
    const normB = normalizeTeamName(teamB.name);
    const h2hGames = (teamA.record || []).filter(g =>
        g.opponent && normalizeTeamName(g.opponent).includes(normB)
    ).slice(-2);

    let avgPaceH2H = 0;
    let hasH2H = h2hGames.length > 0;

    if (hasH2H) {
        avgPaceH2H = h2hGames.reduce((sum, g) => sum + getGamePace(g.score), 0) / h2hGames.length;
    } else if (avgPace5A > 0 && avgPace5B > 0) {
        // Fallback: se não houver H2H, usamos a média dos últimos 5 dos dois times
        avgPaceH2H = (avgPace5A + avgPace5B) / 2;
    }

    // 4. Cálculo Final: Média ponderada (ou simples conforme interpretado)
    let finalPace = 0;
    if (avgPace5A > 0 && avgPace5B > 0 && avgPaceH2H > 0) {
        finalPace = (avgPace5A + avgPace5B + avgPaceH2H) / 3;
    }

    return {
        matchPace: finalPace,
        avgPace5A,
        avgPace5B,
        avgPaceH2H,
        hasH2H
    };
};
