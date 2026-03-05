
import { GameResult, Team } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number; // Margin of last game (+ for win, - for loss)
    lastMarginB?: number;
}

/**
 * ALGORITMO DE RITMO E COLISÃO ESTATÍSTICA v2.1
 * Calcula a projeção exata de pontuação baseada em posses de bola (Pace) e ajustes situacionais.
 */
export const calculateDeterministicPace = (entityA: Team, entityB: Team, options?: PaceOptions) => {
    // Fallback tático caso o rawEspnPayload sofra latência
    const offRtgA = entityA.espnData?.pts || entityA.stats?.media_pontos_ataque || 110.0;
    const defRtgA = entityA.espnData?.pts_contra || entityA.stats?.media_pontos_defesa || 110.0;

    const offRtgB = entityB.espnData?.pts || entityB.stats?.media_pontos_ataque || 110.0;
    const defRtgB = entityB.espnData?.pts_contra || entityB.stats?.media_pontos_defesa || 110.0;

    // Derivação do Pace baseada na relação Ataque/Defesa (Ajuste Médico de 1.05x para posses)
    const estimatedPaceA = offRtgA / 1.05;
    const estimatedPaceB = offRtgB / 1.05;
    let matchPace = (estimatedPaceA + estimatedPaceB) / 2.0;

    // Cálculo de Eficiência Cruzada: Ataque da Entidade vs Defesa do Oponente
    let projectedScoreA = ((offRtgA + defRtgB) / 2.0) * (matchPace / 100.0);
    let projectedScoreB = ((offRtgB + defRtgA) / 2.0) * (matchPace / 100.0);

    // --- REGRAS UNDERDOG & AJUSTES SITUACIONAIS ---

    // 1. Ajuste_Casa (+3 pontos para o time da casa)
    if (options?.isHomeA) {
        projectedScoreA += 1.5;
        projectedScoreB -= 1.5;
    } else {
        projectedScoreB += 1.5;
        projectedScoreA -= 1.5;
    }

    // 2. Ajuste_Fadiga (B2B reduz projeção em ~2.5 pontos)
    if (options?.isB2BA) projectedScoreA -= 2.5;
    if (options?.isB2BB) projectedScoreB -= 2.5;

    // 3. Blowout_Regressao (Vitória anterior >20 reduz projeção em 2 pontos)
    if (options?.lastMarginA && options.lastMarginA > 20) projectedScoreA -= 2.0;
    if (options?.lastMarginB && options.lastMarginB > 20) projectedScoreB -= 2.0;

    // 4. Jogo_Ritmo_Lento (Pace < 98 dificulta blowouts)
    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        // Reduz a diferença projetada em 5%
        const adjustment = spread * 0.05;
        projectedScoreA -= adjustment / 2;
        projectedScoreB += adjustment / 2;
    }

    const totalPayload = projectedScoreA + projectedScoreB;

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > 102.5 ? 'HYPER_KINETIC' : (matchPace < 98 ? 'SLOW_GRIND' : 'STATIC_TRENCH')
    };
};

/**
 * Calculates a momentum score based on the weighted recent results.
 * Wins later in the sequence (more recent) have higher weights.
 */
export const getMomentumScore = (record: GameResult[]) => {
    return record.reduce((score, res, idx) => {
        return score + (res === 'V' ? Math.pow(2, idx) : 0);
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
    const clean = name.toLowerCase().trim();
    return teams.find(t =>
        t.name.toLowerCase() === clean ||
        t.name.toLowerCase().includes(clean) ||
        clean.includes(t.name.toLowerCase())
    );
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
 * Identifica se o confronto possui valor em Underdog baseado nas novas regras.
 */
export const calculateUnderdogValue = (teamA: Team, teamB: Team, analysis: any, marketSpread: number | null) => {
    if (marketSpread === null) return null;

    const rules = [];
    const isUnderdogA = marketSpread > 0; // Se spread > 0 para o time da casa (A), ele é underdog
    const fairSpread = analysis.deltaB - analysis.deltaA;
    const edge = marketSpread - fairSpread;

    // Regra: Underdog_Casa
    if (isUnderdogA) rules.push('Underdog_Casa');

    // Regra: Defesa_Top15 (Simplificado: media_pontos_defesa < media liga ~112)
    const defA = teamA.espnData?.pts_contra || teamA.stats?.media_pontos_defesa || 115;
    if (defA < 112) rules.push('Defesa_Forte');

    // Regra: Total_Baixo
    if (analysis.totalPayload < 214) rules.push('Total_Baixo');

    // Regra: Value_Bet (Diferença >= 3 pontos)
    if (Math.abs(edge) >= 3) rules.push('Value_Bet');

    return {
        hasValue: rules.length >= 2,
        rules,
        edge: edge.toFixed(1)
    };
};
