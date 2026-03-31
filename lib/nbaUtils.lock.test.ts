import { describe, it, expect } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';

describe('nbaUtils - Trava de Segurança Profissional', () => {
    const teamA = {
        name: 'Lakers',
        stats: { media_pontos_ataque: 115, media_pontos_defesa: 110 },
        espnData: { pts: 115, pts_contra: 110 }
    } as any;

    const teamB = {
        name: 'Celtics',
        stats: { media_pontos_ataque: 118, media_pontos_defesa: 108 },
        espnData: { pts: 118, pts_contra: 108 }
    } as any;

    it('deve travar o placar em no máximo 20 pontos abaixo da média da temporada', () => {
        // Simular cenário de desastre: Vários desfalques pesados
        // HW 9 + HW 9 + HW 5 = 23 pontos de penalidade nominal.
        // Defesa de elite (pts_contra 108) = -15 pontos.
        // Total: -38 pontos.
        // Média do Lakers: 115. Sem trava seria 77.
        // Com a trava (-20 pts): deve ser 95.

        const injuriesA = [
            { nome: 'Jogador A', isOut: true, weight: 9 },
            { nome: 'Jogador B', isOut: true, weight: 9 },
            { nome: 'Jogador C', isOut: true, weight: 5 }
        ];

        const result = calculateProjectedScores(teamA, teamB, { injuriesA });

        // Floor: 115 - 20 = 95
        expect(result.deltaA).toBe(95);
    });

    it('não deve interferir se o placar estiver dentro da margem de 20 pontos', () => {
        // Time B com defesa neutra (112 pts_contra) para não derrubar o placar sozinho
        const neutralTeamB = {
            name: 'Celtics',
            stats: { media_pontos_ataque: 118, media_pontos_defesa: 112 },
            espnData: { pts: 118, pts_contra: 112 }
        } as any;

        const injuriesA = [
            { nome: 'D-Lo', isOut: true, weight: 5 }
        ];

        const result = calculateProjectedScores(teamA, neutralTeamB, { injuriesA });

        // Média 115. Penalidade nominal 5 pts. Resultado ~110.
        // Deve permanecer acima de 95 (o piso).
        expect(result.deltaA).toBeGreaterThan(95);
        expect(result.deltaA).toBeLessThan(115);
    });

    it('deve travar ambos os times se necessário', () => {
        // Para forçar o lock sem o multiplicador, precisamos de mais peso
        const injuriesA = [
            { nome: 'Star A1', isOut: true, weight: 10 },
            { nome: 'Star A2', isOut: true, weight: 10 },
            { nome: 'Star A3', isOut: true, weight: 5 }
        ]; // -25 pts

        const injuriesB = [
            { nome: 'Star B1', isOut: true, weight: 10 },
            { nome: 'Star B2', isOut: true, weight: 10 },
            { nome: 'Star B3', isOut: true, weight: 5 }
        ]; // -25 pts

        // Média A: 115 -> Floor 95
        // Média B: 118 -> Floor 98

        const result = calculateProjectedScores(teamA, teamB, { injuriesA, injuriesB });

        expect(result.deltaA).toBe(95);
        expect(result.deltaB).toBe(98);
    });
});
