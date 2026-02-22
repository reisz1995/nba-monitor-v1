
import { GameResult } from '../types';

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
