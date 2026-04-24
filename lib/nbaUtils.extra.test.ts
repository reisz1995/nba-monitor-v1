import { describe, it, expect } from 'vitest';
import { calculateDeterministicPace, calculateProjectedScores } from './nbaUtils';

describe('nbaUtils - Kernels Avançados', () => {
    const teamA = { name: 'Team A', espnData: { pace: 100 } } as any;
    const teamB = { name: 'Team B', espnData: { pace: 102 } } as any;

    describe('Kernel V5.1 - calculateDeterministicPace', () => {
        it('should use hybrid matrix (80/20) for standard power diff', () => {
            const pace = calculateDeterministicPace(
                teamA, teamB, null, null, [], [],
                { defRtg: 105 }, { defRtg: 110 }, 10, 9
            );
            // paceA=99.3, paceB=99.3. strongest=A, bestDef=A.
            // (99.3 * 0.8) + (99.3 * 0.2) = 99.3
            expect(pace).toBeCloseTo(99.3, 0.1);
        });

        it('should trigger Overclock when power diff >= 2.0', () => {
            const pace = calculateDeterministicPace(
                teamA, teamB, null, null, [], [],
                { defRtg: 105 }, { defRtg: 110 }, 12, 9
            );
            expect(pace).toBeCloseTo(99.3 * 1.04, 0.1);
        });

        it('should apply H2H pace adjustment (20% weight)', () => {
            const h2hData = [{ score: '110-110' }]; // Pace total = 220 / (2 * 1.155) = 95.23
            const pace = calculateDeterministicPace(
                teamA, teamB, null, null, [], [],
                { defRtg: 105 }, { defRtg: 110 }, 10, 10,
                h2hData
            );
            // basePace = 99.3
            // h2hPace = 220 / (2 * 1.155) = 95.23
            // final = (99.3 * 0.8) + (95.23 * 0.2) = 79.44 + 19.046 = 98.486
            expect(pace).toBeCloseTo(98.48, 0.1);
        });
    });

    describe('Kernel V5.3.4 - applySuperiorityFilters (via calculateProjectedScores)', () => {
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

        it('should identify and boost Shootouts (combined Offense >= 122)', () => {
            const result = calculateProjectedScores(eliteTeamA, eliteTeamB, { powerA: 10, powerB: 10, isHomeA: true });
            expect(result.totalPayload).toBeGreaterThan(240);
        });

        it('should apply friction to Dogfights (Power Diff < 1.5 and not shootout)', () => {
            const result = calculateProjectedScores(averageTeamA, averageTeamB, { powerA: 5.0, powerB: 5.5, isHomeA: true });

            // baseProjA = 110 * 0.993 = 109.23
            // baseProjB = 110 * 0.993 = 109.23
            // powerDiff = 0.5. diffB = 0.5 * 1.1 = 0.55. projB = 109.78
            // HomeAdv = 1.75. projA = 109.23 + 1.75 = 110.98, projB = 109.78 - 1.75 = 108.03
            // Dogfight penalty = -1.5 each. 
            // finalA = 110.98 - 1.5 = 109.48
            // finalB = 108.03 - 1.5 = 106.53
            expect(result.deltaA).toBeCloseTo(109.53, 1);
            expect(result.deltaB).toBeCloseTo(106.48, 1);
        });
    });
});
