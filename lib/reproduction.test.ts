import { describe, it, expect } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';

describe('Volatility Filter Anomaly Reproduction', () => {
    it('should apply volatility filter to BOTH teams proportionally', () => {
        const teamA = { name: 'Team A', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;
        const teamB = { name: 'Team B', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;

        const databallrA = { ortg: 100, drtg: 100, net_rating: -10, pace: 100 };
        const databallrB = { ortg: 100, drtg: 100, net_rating: -20, pace: 100 };

        const optionsNoVol = { aiScoreA: 10.0, aiScoreB: 10.0, isHomeA: true };
        const optionsWithVol = { aiScoreA: 3.0, aiScoreB: 3.0, isHomeA: true };

        const resultNoVol = calculateProjectedScores(teamA, teamB, optionsNoVol, databallrA, databallrB);
        const resultWithVol = calculateProjectedScores(teamA, teamB, optionsWithVol, databallrA, databallrB);

        const diffA = resultWithVol.deltaA - resultNoVol.deltaA;
        const diffB = resultWithVol.deltaB - resultNoVol.deltaB;

        console.log(`Diff A: ${diffA}`);
        console.log(`Diff B: ${diffB}`);

        // A should increase by abs(netB) = 20
        // B should increase by abs(netA) = 10
        expect(diffA).toBeCloseTo(20, 1);
        expect(diffB).toBeCloseTo(10, 1);
    });

    it('should NOT apply volatility filter if one team is missing net_rating', () => {
        const teamA = { name: 'Team A', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;
        const teamB = { name: 'Team B', stats: { media_pontos_ataque: 100, media_pontos_defesa: 100 }, espnData: { pts: 100, pts_contra: 100, pace: 100 } } as any;

        const databallrA = { ortg: 100, drtg: 100, net_rating: -10, pace: 100 };
        const databallrB = { ortg: 100, drtg: 100, net_rating: undefined as any, pace: 100 };

        const optionsNoVol = { aiScoreA: 10.0, aiScoreB: 10.0, isHomeA: true };
        const optionsWithVol = { aiScoreA: 3.0, aiScoreB: 3.0, isHomeA: true };

        const resultNoVol = calculateProjectedScores(teamA, teamB, optionsNoVol, databallrA, databallrB);
        const resultWithVol = calculateProjectedScores(teamA, teamB, optionsWithVol, databallrA, databallrB);

        const diffA = resultWithVol.deltaA - resultNoVol.deltaA;
        const diffB = resultWithVol.deltaB - resultNoVol.deltaB;

        // Both should be 0 because of the symmetry requirement
        expect(diffA).toBe(0);
        expect(diffB).toBe(0);
    });
});
