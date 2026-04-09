import { describe, it, expect } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';

describe('nbaUtils - Trava de Segurança Profissional', () => {
    const teamA = {
        name: 'Lakers',
        stats: { media_pontos_ataque: 120, media_pontos_defesa: 112 },
        espnData: { pts: 120, pts_contra: 112 }
    } as any;

    const teamB = {
        name: 'Celtics',
        stats: { media_pontos_ataque: 120, media_pontos_defesa: 110 },
        espnData: { pts: 120, pts_contra: 110 }
    } as any;

    it('deve travar o placar em no máximo 17 pontos abaixo da média da temporada', () => {
        // Simular cenário de desastre: 2 lesões peso 9 (HW 9)
        // Cada lesão HW 9 remove (9 * 2) + 2 = 20 pontos.
        // Total de penalidade: 40 pontos.
        // Média do Lakers: 115. Placar sem trava seria ~75.
        // Com a trava (-20 pts): deve ser 95.

        const injuriesA = [
            { nome: 'LeBron James', isOut: true, weight: 9 },
            { nome: 'Anthony Davis', isOut: true, weight: 9 }
        ];

        const result = calculateProjectedScores(teamA, teamB, { injuriesA });

        // Média 115 - 17 = 98. Média atual 120 - 17 = 103.
        expect(result.deltaA).toBe(103);
        expect(result.deltaA).toBeGreaterThan(100);
    });

    it('não deve interferir se o placar estiver dentro da margem de 17 pontos', () => {
        // Time B com defesa neutra (112 pts_contra) para não derrubar o placar sozinho
        const neutralTeamB = {
            name: 'Celtics',
            stats: { media_pontos_ataque: 120, media_pontos_defesa: 113 },
            espnData: { pts: 120, pts_contra: 113 }
        } as any;

        const injuriesA = [
            { nome: 'D-Lo', isOut: true, weight: 5 }
        ];

        const result = calculateProjectedScores(teamA, neutralTeamB, { injuriesA });

        // Com weight 5, a penalidade é de 5 pontos (menor que threshold 7, não ativa penalty dupla)
        // O floor é 120 - 17 = 103, mas o placar projetado está acima do floor
        // então não deve haver clamp para baixo
        expect(result.deltaA).toBeGreaterThan(103);
    });

    it('deve travar ambos os times se necessário', () => {
        const injuriesA = [{ nome: 'Star A', isOut: true, weight: 10 }]; // -22 pts
        const injuriesB = [{ nome: 'Star B', isOut: true, weight: 10 }]; // -22 pts

        // Média A: 120 -> Floor 103
        // Média B: 120 -> Floor 103

        const result = calculateProjectedScores(teamA, teamB, { injuriesA, injuriesB });

        expect(result.deltaA).toBe(103);
        expect(result.deltaB).toBe(103);
    });
});