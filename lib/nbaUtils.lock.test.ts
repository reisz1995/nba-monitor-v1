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

        // Média 115 - 20 = 95
        expect(result.deltaA).toBe(95);
        expect(result.deltaA).toBeGreaterThan(75);
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

        // Média 115. Sem a trava agressiva, o placar ficaria na casa dos 105-110.
        // Deve permanecer acima de 95 (o piso).
        expect(result.deltaA).toBeGreaterThan(95);
        expect(result.deltaA).toBeLessThan(115);
    });

    it('deve travar ambos os times se necessário', () => {
        const injuriesA = [{ nome: 'Star A', isOut: true, weight: 10 }]; // -22 pts
        const injuriesB = [{ nome: 'Star B', isOut: true, weight: 10 }]; // -22 pts

        // Média A: 115 -> Floor 95
        // Média B: 118 -> Floor 98

        const result = calculateProjectedScores(teamA, teamB, { injuriesA, injuriesB });

        expect(result.deltaA).toBe(95);
        expect(result.deltaB).toBe(98);
    });
});
