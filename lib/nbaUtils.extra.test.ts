import { describe, it, expect } from 'vitest';
import { calculateDeterministicPace, calculateProjectedScores } from './nbaUtils';

describe('nbaUtils - Kernels Avançados', () => {
    const teamA = { name: 'Team A', espnData: { pace: 100 } } as any;
    const teamB = { name: 'Team B', espnData: { pace: 102 } } as any;

    describe('Kernel V5.1 - calculateDeterministicPace', () => {
        it('should use hybrid matrix (60/40) for standard power diff', () => {
            const pace = calculateDeterministicPace(
                teamA, teamB, null, null, [], [],
                { defRtg: 105 }, { defRtg: 110 }, 10, 9
            );
            expect(pace).toBeCloseTo(99.3, 0.1); // Fallback pace
        });

        it('should trigger Overclock when power diff >= 2.0', () => {
            const pace = calculateDeterministicPace(
                teamA, teamB, null, null, [], [],
                { defRtg: 105 }, { defRtg: 110 }, 12, 9
            );
            expect(pace).toBeCloseTo(99.3 * 1.04, 0.1); // Fallback * Boost
        });
    });

    describe('Kernel V5.3.1 - applySuperiorityFilters (via calculateProjectedScores)', () => {
        const eliteTeamA = {
            name: 'Elite Suns',
            espnData: { pts: 125, pts_contra: 105, pace: 100 },
            stats: { media_pontos_ataque: 125, media_pontos_defesa: 105 }
        } as any;
        const eliteTeamB = {
            name: 'Elite Rockets',
            espnData: { pts: 125, pts_contra: 105, pace: 100 },
            stats: { media_pontos_ataque: 125, media_pontos_defesa: 105 }
        } as any;

        const averageTeamA = {
            name: 'Avg A',
            espnData: { pts: 110, pts_contra: 110, pace: 100 },
            stats: { media_pontos_ataque: 110, media_pontos_defesa: 110 }
        } as any;
        const averageTeamB = {
            name: 'Avg B',
            espnData: { pts: 110, pts_contra: 110, pace: 100 },
            stats: { media_pontos_ataque: 110, media_pontos_defesa: 110 }
        } as any;

        it('should identify and boost Shootouts (combined Offense >= 124)', () => {
            const result = calculateProjectedScores(eliteTeamA, eliteTeamB, { aiScoreA: 10, aiScoreB: 10, isHomeA: true });
            expect(result.totalPayload).toBeGreaterThan(240);
        });

        it('should apply friction to Dogfights (Power Diff < 1.5 and not shootout)', () => {
            // Math precise:
            // pace = 99.3. base = 110 * 0.993 = 109.23
            // powerDiff = 0.5. boost = 0.5 * 1.1 = 0.55
            // projB = 109.23 + 0.55 = 109.78
            // Dogfight penalty = -3.5 each
            // HomeAdv = 1.75 (A is home)
            // deltaA = 109.23 - 3.5 + 1.75 = 107.48
            // deltaB = 109.78 - 3.5 - 1.75 = 104.53
            const result = calculateProjectedScores(averageTeamA, averageTeamB, { aiScoreA: 5.0, aiScoreB: 5.5, isHomeA: true });

            expect(result.deltaA).toBeCloseTo(107.48, 0.1);
            expect(result.deltaB).toBeCloseTo(104.53, 0.1);
        });
    });
});
