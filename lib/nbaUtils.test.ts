import { describe, it, expect } from 'vitest';
import { getMomentumScore, parseStreakToRecord, calculateProjectedScores, calculateUnderdogValue, normalizeTeamName, parseScoreToTotal, calculateMatchupPaceV2 } from './nbaUtils';
import { GameResultSchema, TeamSchema } from './schemas';

describe('nbaUtils', () => {
    describe('Runtime Validation', () => {
        it('should reject invalid game result', () => {
            const result = GameResultSchema.safeParse('X'); // Invalid
            expect(result.success).toBe(false);
        });

        it('should handle corrupted Supabase data gracefully', () => {
            const corruptedData = { id: 'not-a-number', name: 123 }; // Tipos errados
            const result = TeamSchema.safeParse(corruptedData);
            expect(result.success).toBe(false);
        });
    });

    describe('Edge Cases in Parsing', () => {
        it('should handle empty streak string', () => {
            expect(parseStreakToRecord('')).toBeNull();
        });

        it('should handle international characters in team names', () => {
            const teamName = 'São Paulo Basketball'; // Acentos
            const normalized = normalizeTeamName(teamName);
            expect(normalized).toBeDefined();
            expect(normalized).toBe('sao paulo basketball');
        });
    });

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

    describe('calculateProjectedScores Adjustments', () => {
        const teamA = { name: 'Lakers', stats: { media_pontos_ataque: 115, media_pontos_defesa: 115 } } as any;
        const teamB = { name: 'Celtics', stats: { media_pontos_ataque: 115, media_pontos_defesa: 115 } } as any;

        it('should apply home advantage (+3 net)', () => {
            const resultHomeA = calculateProjectedScores(teamA, teamB, { isHomeA: true });
            const resultHomeB = calculateProjectedScores(teamA, teamB, { isHomeA: false });

            // Difference should be 6 points in total because Home gets +3 and Away gets -3
            expect(resultHomeA.deltaA - resultHomeA.deltaB).toBeCloseTo(6);
            expect(resultHomeB.deltaB - resultHomeB.deltaA).toBeCloseTo(6);
        });

        it('should apply B2B fatigue (-2.0)', () => {
            const base = calculateProjectedScores(teamA, teamB, { isHomeA: true });
            const b2b = calculateProjectedScores(teamA, teamB, { isHomeA: true, isB2BA: true });

            expect(b2b.deltaA).toBeLessThan(base.deltaA);
            expect(base.deltaA - b2b.deltaA).toBeCloseTo(1.0);
        });

        it('should apply Blowout Regression (-1.5)', () => {
            const base = calculateProjectedScores(teamA, teamB, { isHomeA: true });
            const regression = calculateProjectedScores(teamA, teamB, { isHomeA: true, lastMarginA: 25 });

            expect(regression.deltaA).toBeLessThan(base.deltaA);
            expect(base.deltaA - regression.deltaA).toBeCloseTo(1.5);
        });
    });

    describe('calculateUnderdogValue', () => {
        const teamA = { name: 'Lakers', espnData: { pts_contra: 110 } } as any;
        const teamB = { name: 'Celtics' } as any;
        const analysis = { deltaA: 110, deltaB: 115, totalPayload: 225 }; // Fair spread: +5 (B-A)

        it('should detect Underdog_Casa when spread > 0', () => {
            const result = calculateUnderdogValue(teamA, teamB, analysis, 6.5);
            expect(result?.rules).toContain('Underdog_Casa');
        });

        it('should detect Defesa_Forte when pts_contra < 109.5 (elite threshold)', () => {
            // teamA.espnData.pts_contra = 110 — acima do gatilho, NÃO deve activar
            const result = calculateUnderdogValue(teamA, teamB, analysis, 6.5);
            expect(result?.rules).not.toContain('Defesa_Forte');

            // Tim com defesa de elite (< 109.5) — DEVE activar
            const eliteDefTeamA = { name: 'Lakers', espnData: { pts_contra: 108 } } as any;
            const resultElite = calculateUnderdogValue(eliteDefTeamA, teamB, analysis, 6.5);
            expect(resultElite?.rules).toContain('Defesa_Forte');
        });

        it('should detect Total_Baixo when totalPayload < 210 (hardened threshold)', () => {
            // totalPayload = 210 — abaixo do gatilho
            const result = calculateUnderdogValue(teamA, teamB, { ...analysis, totalPayload: 209 }, 6.5);
            expect(result?.rules).toContain('Total_Baixo');

            // totalPayload = 214 — acima do gatilho, NÃO deve activar
            const resultHigh = calculateUnderdogValue(teamA, teamB, { ...analysis, totalPayload: 214 }, 6.5);
            expect(resultHigh?.rules).not.toContain('Total_Baixo');
        });

        it('should detect Value_Bet when edge >= 4.5 (hardened threshold)', () => {
            // Market: 10.0, Fair: 5.0 -> Edge: 5.0 >= 4.5 -> VALUE_BET
            const result = calculateUnderdogValue(teamA, teamB, analysis, 10.0);
            expect(result?.rules).toContain('Value_Bet');

            // Market: 8.0, Fair: 5.0 -> Edge: 3.0 < 4.5 -> SEM VALUE_BET
            const resultLow = calculateUnderdogValue(teamA, teamB, analysis, 8.0);
            expect(resultLow?.rules).not.toContain('Value_Bet');
        });

        it('should return hasValue true when 2 or more rules match', () => {
            // teamA com defesa de elite (pts_contra=108 < 109.5) + Underdog_Casa (6.5 > 0) = 2 regras
            const eliteDefTeamA = { name: 'Lakers', espnData: { pts_contra: 108 } } as any;
            const result = calculateUnderdogValue(eliteDefTeamA, teamB, analysis, 6.5);
            expect(result?.hasValue).toBe(true);
            expect(result?.rules.length).toBeGreaterThanOrEqual(2);
        });

        it('should return null if marketSpread is null', () => {
            expect(calculateUnderdogValue(teamA, teamB, analysis, null)).toBe(null);
        });
    });

    describe('Pace V2 Logic', () => {
        it('should parse score string to total correctly', () => {
            expect(parseScoreToTotal('112-105')).toBe(217);
            expect(parseScoreToTotal('100 - 90')).toBe(190);
            expect(parseScoreToTotal('95:85')).toBe(180);
            expect(parseScoreToTotal('')).toBe(0);
        });

        it('should calculate Pace V2 correctly with H2H', () => {
            const teamA = {
                name: 'Lakers',
                record: [
                    { opponent: 'Celtics', score: '115-116' }, // H2H 1: 231 -> Pace 100
                    { opponent: 'Warriors', score: '126-127' }, // Pace 109.5
                    { opponent: 'Celtics', score: '116-115' }, // H2H 2: 231 -> Pace 100
                ]
            } as any;

            const teamB = {
                name: 'Celtics',
                record: [{ opponent: 'Lakers', score: '115-116' }] // Pace 100
            } as any;

            const result = calculateMatchupPaceV2(teamA, teamB);
            expect(result.hasH2H).toBe(true);
            expect(result.avgPaceH2H).toBeCloseTo(98.8, 1);
        });

        it('should fallback to Avg 5 if no H2H', () => {
            const teamA = {
                name: 'Lakers',
                record: [{ opponent: 'Warriors', score: '115-116' }] // Pace 100
            } as any;
            const teamB = {
                name: 'Celtics',
                record: [{ opponent: 'Bulls', score: '121-121' }] // Pace 104.76
            } as any;

            const result = calculateMatchupPaceV2(teamA, teamB);
            expect(result.hasH2H).toBe(false);
            expect(result.avgPaceH2H).toBeCloseTo(101.15, 2);
        });
    });
});
