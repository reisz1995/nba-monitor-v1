import { describe, it, expect } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';

describe('Volatility Filter Anomaly Reproduction', () => {
    it('should apply volatility filter to BOTH teams proportionally', () => {
        const teamA = { name: 'Team A', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;
        const teamB = { name: 'Team B', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;

        const databallrA = { ortg: 100, drtg: 100, net_rating: -10, pace: 100 };
        const databallrB = { ortg: 100, drtg: 100, net_rating: -20, pace: 100 };

        const optionsNoVol = { powerA: 10.0, powerB: 10.0, isHomeA: true };
        const optionsWithVol = { powerA: 3.0, powerB: 3.0, isHomeA: true };

        const resultNoVol = calculateProjectedScores(teamA, teamB, optionsNoVol, databallrA, databallrB);
        const resultWithVol = calculateProjectedScores(teamA, teamB, optionsWithVol, databallrA, databallrB);

        const diffA = resultWithVol.deltaA - resultNoVol.deltaA;
        const diffB = resultWithVol.deltaB - resultNoVol.deltaB;

        console.log(`Diff A: ${diffA}`);
        console.log(`Diff B: ${diffB}`);

        // A: netB=-20 gives +4.0, netA=-10 gives -3.0 (penalty), netA=-10 gives -3.0 = -2.0?
        // Actually: Bônus A = min(20, 4.0) = 4.0. Penalidade A = min(10*0.6, 3.0) = 3.0.
        // Net effect A: +4.0 - 3.0 = +1.0
        expect(diffA).toBeCloseTo(1, 0);

        // B: netA=-10 gives +4.0, netB=-20 gives -3.0 = +1.0
        expect(diffB).toBeCloseTo(1, 0);
    });

    it('should NOT apply volatility filter if one team is missing net_rating', () => {
        const teamA = { name: 'Team A', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;
        const teamB = { name: 'Team B', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;

        const databallrA = { ortg: 100, drtg: 100, net_rating: -10, pace: 100 };
        const databallrB = { ortg: 100, drtg: 100, net_rating: undefined as any, pace: 100 };

        const optionsNoVol = { powerA: 10.0, powerB: 10.0, isHomeA: true };
        const optionsWithVol = { powerA: 3.0, powerB: 3.0, isHomeA: true };

        const resultNoVol = calculateProjectedScores(teamA, teamB, optionsNoVol, databallrA, databallrB);
        const resultWithVol = calculateProjectedScores(teamA, teamB, optionsWithVol, databallrA, databallrB);

        const diffA = resultWithVol.deltaA - resultNoVol.deltaA;
        const diffB = resultWithVol.deltaB - resultNoVol.deltaB;

        // Both should be 0 because of the symmetry requirement
        expect(diffA).toBe(0);
        expect(diffB).toBe(0);
    });
});
