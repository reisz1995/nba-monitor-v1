import { describe, it, expect } from 'vitest';
import { getMomentumScore, parseStreakToRecord } from './nbaUtils';

describe('nbaUtils', () => {
    describe('getMomentumScore', () => {
        it('should calculate higher score for more recent wins', () => {
            // Recent win is better than older win
            const oldWin = getMomentumScore(['V', 'D', 'D', 'D', 'D']);
            const recentWin = getMomentumScore(['D', 'D', 'D', 'D', 'V']);

            expect(recentWin).toBeGreaterThan(oldWin);
            expect(oldWin).toBe(1); // 2^0
            expect(recentWin).toBe(16); // 2^4
        });

        it('should return 0 for all losses', () => {
            const score = getMomentumScore(['D', 'D', 'D', 'D', 'D']);
            expect(score).toBe(0);
        });

        it('should calculate correct score for mixed results', () => {
            // V-D-V-D-V -> 1*2^0 + 0*2^1 + 1*2^2 + 0*2^3 + 1*2^4 = 1 + 4 + 16 = 21
            const score = getMomentumScore(['V', 'D', 'V', 'D', 'V']);
            expect(score).toBe(21);
        });
    });

    describe('parseStreakToRecord', () => {
        it('should parse W-format streaks correctly', () => {
            const record = parseStreakToRecord('W3');
            expect(record).toEqual(['D', 'D', 'V', 'V', 'V']);
        });

        it('should parse L-format streaks correctly', () => {
            const record = parseStreakToRecord('L2');
            expect(record).toEqual(['V', 'V', 'V', 'D', 'D']);
        });

        it('should cap W-format streaks at 5', () => {
            const record = parseStreakToRecord('W10');
            expect(record).toEqual(['V', 'V', 'V', 'V', 'V']);
        });

        it('should parse dash-separated format correctly', () => {
            const record = parseStreakToRecord('V-V-D-V-D');
            expect(record).toEqual(['V', 'V', 'D', 'V', 'D']);
        });

        it('should truncate long dash-separated format', () => {
            const record = parseStreakToRecord('V-V-V-V-V-D');
            expect(record).toEqual(['V', 'V', 'V', 'V', 'D']);
        });

        it('should pad short dash-separated format', () => {
            const record = parseStreakToRecord('V-D');
            // If short, it repeats the inverse of the first element or something similar?
            // Looking at implementation: while (results.length < 5) results.unshift(results[0] === 'V' ? 'D' : 'V');
            // For 'V-D', results = ['V', 'D']
            // 1st iteration: unshift 'D' -> ['D', 'V', 'D']
            // 2nd iteration: unshift 'V' -> ['V', 'D', 'V', 'D']
            // 3rd iteration: unshift 'D' -> ['D', 'V', 'D', 'V', 'D']
            expect(record).toEqual(['D', 'V', 'D', 'V', 'D']);
        });

        it('should return null for empty input', () => {
            expect(parseStreakToRecord('')).toBe(null);
        });
    });
});
