
import { GameResult, Team } from '../types';

/**
 * ALGORITMO DE RITMO E COLISÃO ESTATÍSTICA v2.0
 * Calcula a projeção exata de pontuação baseada em posses de bola (Pace).
 */
export const calculateDeterministicPace = (entityA: Team, entityB: Team) => {
    // Fallback tático caso o rawEspnPayload sofra latência
    const offRtgA = entityA.espnData?.pts || entityA.stats?.media_pontos_ataque || 110.0;
    const defRtgA = entityA.espnData?.pts_contra || entityA.stats?.media_pontos_defesa || 110.0;

    const offRtgB = entityB.espnData?.pts || entityB.stats?.media_pontos_ataque || 110.0;
    const defRtgB = entityB.espnData?.pts_contra || entityB.stats?.media_pontos_defesa || 110.0;

    // Derivação do Pace baseada na relação Ataque/Defesa (Ajuste Médico de 1.05x para posses)
    const estimatedPaceA = offRtgA / 1.05;
    const estimatedPaceB = offRtgB / 1.05;
    const matchPace = (estimatedPaceA + estimatedPaceB) / 2.0;

    // Cálculo de Eficiência Cruzada: Ataque da Entidade vs Defesa do Oponente
    const projectedScoreA = ((offRtgA + defRtgB) / 2.0) * (matchPace / 100.0);
    const projectedScoreB = ((offRtgB + defRtgA) / 2.0) * (matchPace / 100.0);
    const totalPayload = projectedScoreA + projectedScoreB;

    return {
        matchPace,
        totalPayload,
        deltaA: projectedScoreA,
        deltaB: projectedScoreB,
        kineticState: matchPace > 102.5 ? 'HYPER_KINETIC' : 'STATIC_TRENCH'
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
