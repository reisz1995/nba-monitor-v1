import { describe, it, expect, vi } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';
import { Team } from '../types';

describe('nbaUtils - Novas Regras de Playoff (v5.4)', () => {
    const mockTeamA: Team = {
        name: 'Boston Celtics',
        record: [{ score: '120-110' }, { score: '125-115' }, { score: '118-112' }, { score: '130-120' }, { score: '122-110' }],
        stats: { media_pontos_ataque: 120, media_pontos_defesa: 110 },
        espnData: { pts: 120, pts_contra: 110, pace: 100 }
    } as any;

    const mockTeamB: Team = {
        name: 'Indiana Pacers',
        record: [{ score: '120-110' }, { score: '125-115' }, { score: '118-112' }, { score: '130-120' }, { score: '122-110' }],
        stats: { media_pontos_ataque: 120, media_pontos_defesa: 115 },
        espnData: { pts: 120, pts_contra: 115, pace: 102 }
    } as any;

    it('deve respeitar o teto de 124 pontos nos playoffs', () => {
        // Forçamos um cenário de shootout absurdo
        const options = {
            editorInsight: 'Playoff Game 1: Super Ataque',
            isHomeA: true,
            powerA: 10, // Muito superior
            powerB: 2
        };

        const result = calculateProjectedScores(mockTeamA, mockTeamB, options);
        
        expect(result.isPlayoff).toBe(true);
        expect(result.deltaA).toBeLessThanOrEqual(124);
        expect(result.deltaB).toBeLessThanOrEqual(124);
    });

    it('deve reduzir bônus ofensivos (ATK_FILTER_MULT) nos playoffs', () => {
        const optionsRegular = {
            editorInsight: 'Regular Season Game',
            powerA: 5,
            powerB: 5
        };

        const optionsPlayoff = {
            editorInsight: 'Playoff Game 1',
            powerA: 5,
            powerB: 5
        };

        const resRegular = calculateProjectedScores(mockTeamA, mockTeamB, optionsRegular);
        const resPlayoff = calculateProjectedScores(mockTeamA, mockTeamB, optionsPlayoff);

        // No playoff, o totalPayload deve ser menor devido à redução do multiplicador de ataque e bônus
        expect(resPlayoff.totalPayload).toBeLessThan(resRegular.totalPayload);
    });
});
