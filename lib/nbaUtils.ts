
import { GameResult, Team } from '../types';

export interface PaceOptions {
    isHomeA?: boolean;
    isB2BA?: boolean;
    isB2BB?: boolean;
    lastMarginA?: number; // Margin of last game (+ for win, - for loss)
    lastMarginB?: number;
}

/**
 * ALGORITMO DE RITMO E COLISÃO ESTATÍSTICA v2.2 (RECALIBRADO)
 * Projeção rigorosa de pontuação minimizando a elasticidade do fator Underdog.
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

    // --- REGRAS & AJUSTES SITUACIONAIS ---

    // 1. Ajuste_Casa (+3 pontos para o time da casa)
    if (options?.isHomeA) {
        projectedScoreA += 1.5;
        projectedScoreB -= 1.5;
    } else {
        projectedScoreB += 1.5;
        projectedScoreA -= 1.5;
    }

    // 2. Ajuste_Fadiga (B2B reduz projeção em ~2.0 pontos, marginalmente menos agressivo para não punir favoritos cegamente)
    if (options?.isB2BA) projectedScoreA -= 2.0;
    if (options?.isB2BB) projectedScoreB -= 2.0;

    // 3. Blowout_Regressao (Vitória anterior >20 reduz projeção em 1.5 pontos)
    if (options?.lastMarginA && options.lastMarginA > 20) projectedScoreA -= 1.5;
    if (options?.lastMarginB && options.lastMarginB > 20) projectedScoreB -= 1.5;

    // 4. Jogo_Ritmo_Lento (Pace < 98) - Compressão de vantagem do favorito severamente reduzida de 5% para 2%
    if (matchPace < 98) {
        const spread = projectedScoreA - projectedScoreB;
        const adjustment = spread * 0.02; // Vector 1: Redução do peso Underdog
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
