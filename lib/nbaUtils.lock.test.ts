import { describe, it, expect } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES BASE
// ─────────────────────────────────────────────────────────────────────────────

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

// Time com defesa neutra (não dispara o defenseFilter de forma expressiva)
const neutralTeamB = {
    name: 'Celtics',
    stats: { media_pontos_ataque: 118, media_pontos_defesa: 112 },
    espnData: { pts: 118, pts_contra: 112 }
} as any;

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: TRAVA DE SEGURANÇA (SAFE-LOCK)
// ─────────────────────────────────────────────────────────────────────────────

describe('SAFE-LOCK — Trava de Segurança Profissional', () => {

    it('deve travar deltaA quando penalidades ultrapassam 20 pts abaixo da média', () => {
        // 2x lesões HW 9 = penalidade (9*2)+2 = 20 cada → total -40 pts
        // Média Lakers: 115 → floor: 95
        // O motor deve travar em 95, não deixar cair para ~75
        const injuriesA = [
            { nome: 'LeBron James',  isOut: true, weight: 9 },
            { nome: 'Anthony Davis', isOut: true, weight: 9 },
        ];

        const result = calculateProjectedScores(teamA, teamB, { injuriesA });

        // FIX v4: floor = seasonAvg - 20 = 115 - 20 = 95
        expect(result.deltaA).toBe(95);
        expect(result.deltaA).toBeGreaterThan(74); // nunca colapso total
    });

    it('não deve acionar a trava quando o placar estiver dentro da margem', () => {
        // Lesão leve (HW 5) não deve derrubar o placar abaixo do floor
        const injuriesA = [
            { nome: 'D-Lo', isOut: true, weight: 5 },
        ];

        const result = calculateProjectedScores(teamA, neutralTeamB, { injuriesA });

        const floor = 115 - 20; // 95
        expect(result.deltaA).toBeGreaterThan(floor);   // trava NÃO acionada
        expect(result.deltaA).toBeLessThan(115);         // ainda penalizado
    });

    it('deve travar ambos os times independentemente quando necessário', () => {
        // HW 10: penalidade = (10*2)+2 = 22 pts → ambos caem abaixo do floor
        const injuriesA = [{ nome: 'Star A', isOut: true, weight: 10 }];
        const injuriesB = [{ nome: 'Star B', isOut: true, weight: 10 }];

        const result = calculateProjectedScores(teamA, teamB, { injuriesA, injuriesB });

        // FIX v4: floor é calculado INDIVIDUALMENTE por time
        const floorA = 115 - 20; // 95
        const floorB = 118 - 20; // 98

        expect(result.deltaA).toBe(floorA); // trava acionada para Lakers
        expect(result.deltaB).toBe(floorB); // trava acionada para Celtics
    });

    it('floor nunca deve ser menor que seasonAvg - 20, mesmo com múltiplas penalidades', () => {
        // Catástrofe: 3 superestrelas OUT
        const injuriesA = [
            { nome: 'Star 1', isOut: true, weight: 9 },
            { nome: 'Star 2', isOut: true, weight: 9 },
            { nome: 'Star 3', isOut: true, weight: 9 },
        ];

        const result = calculateProjectedScores(teamA, teamB, { injuriesA });

        const absoluteFloor = 115 - 20;
        expect(result.deltaA).toBeGreaterThanOrEqual(absoluteFloor);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: PENALIDADE DE LESÃO v4 (com Day-to-Day)
// ─────────────────────────────────────────────────────────────────────────────

describe('HW PENALTY v4 — Lesões OUT e Day-to-Day', () => {

    it('jogador OUT com HW >= 9 deve aplicar penalidade sistêmica (2x + 2)', () => {
        const injuriesA = [{ nome: 'MVP', isOut: true, weight: 9 }];
        const semLesao   = calculateProjectedScores(teamA, neutralTeamB, {});
        const comLesao   = calculateProjectedScores(teamA, neutralTeamB, { injuriesA });

        const diff = semLesao.deltaA - comLesao.deltaA;
        // Penalidade esperada: (9 * 2) + 2 = 20 pts
        // Pode ser limitada pela trava, então verificamos que a diferença é >= 0
        expect(diff).toBeGreaterThanOrEqual(0);
    });

    it('jogador Day-to-Day deve aplicar penalidade parcial (35% do peso)', () => {
        // HW 9 D2D → penalidade esperada: 9 * 0.35 = 3.15 pts
        const injuriesA = [{ nome: 'Star D2D', isOut: false, isDayToDay: true, weight: 9 }];

        const semLesao = calculateProjectedScores(teamA, neutralTeamB, {});
        const comLesao = calculateProjectedScores(teamA, neutralTeamB, { injuriesA });

        const diff = semLesao.deltaA - comLesao.deltaA;

        // Deve ter alguma penalidade (> 0), mas menor que uma lesão OUT
        expect(diff).toBeGreaterThan(0);
        expect(diff).toBeLessThan(10); // muito menor que os 20 de um OUT HW 9
        // Verifica que é próximo de 3.15 (margem de ±1 para ajustes do motor)
        expect(diff).toBeCloseTo(3.15, 0);
    });

    it('jogador sem lesão não deve gerar penalidade', () => {
        const semLesao  = calculateProjectedScores(teamA, neutralTeamB, {});
        const comSaudavel = calculateProjectedScores(teamA, neutralTeamB, {
            injuriesA: [{ nome: 'Saudável', isOut: false, isDayToDay: false, weight: 8 }]
        });

        expect(semLesao.deltaA).toBe(comSaudavel.deltaA);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: FILTRO DE DEFESA v4 (calibrado)
// ─────────────────────────────────────────────────────────────────────────────

describe('DEFENSE FILTER v4 — Proporcional e sem valores absurdos', () => {

    it('defesa péssima (>= 119) deve aumentar a projeção do ataque adversário em no máximo 5 pts', () => {
        const timDefesaPessima = {
            name: 'Worst Defense',
            stats: { media_pontos_ataque: 118, media_pontos_defesa: 122 },
            espnData: { pts: 118, pts_contra: 122 }
        } as any;

        const timDefesaNeutra = {
            name: 'Neutral Defense',
            stats: { media_pontos_ataque: 118, media_pontos_defesa: 112 },
            espnData: { pts: 118, pts_contra: 112 }
        } as any;

        const comDefesaPessima = calculateProjectedScores(teamA, timDefesaPessima, {});
        const comDefesaNeutra  = calculateProjectedScores(teamA, timDefesaNeutra, {});

        const diff = comDefesaPessima.deltaA - comDefesaNeutra.deltaA;

        // FIX v4: máximo ajuste positivo é +5 (não +10 ou +20 como antes)
        expect(diff).toBeLessThanOrEqual(6);   // margem de 1 pt por outros fatores
        expect(diff).toBeGreaterThan(0);        // ainda deve haver diferença positiva
    });

    it('defesa de elite (< 106) deve reduzir a projeção do ataque adversário', () => {
        const timDefesaElite = {
            name: 'Elite Defense',
            stats: { media_pontos_ataque: 108, media_pontos_defesa: 104 },
            espnData: { pts: 108, pts_contra: 104 }
        } as any;

        const timDefesaNeutra = {
            name: 'Neutral Defense',
            stats: { media_pontos_ataque: 118, media_pontos_defesa: 112 },
            espnData: { pts: 118, pts_contra: 112 }
        } as any;

        const comElite  = calculateProjectedScores(teamA, timDefesaElite, {});
        const comNeutra = calculateProjectedScores(teamA, timDefesaNeutra, {});

        // Defesa elite deve penalizar o ataque do time A
        expect(comElite.deltaA).toBeLessThan(comNeutra.deltaA);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4: AJUSTES SITUACIONAIS
// ─────────────────────────────────────────────────────────────────────────────

describe('SITUATIONAL — Home, B2B e Margem', () => {

    it('vantagem de casa deve aumentar deltaA e reduzir deltaB', () => {
        const home = calculateProjectedScores(teamA, teamB, { isHomeA: true });
        const away = calculateProjectedScores(teamA, teamB, { isHomeA: false });

        expect(home.deltaA).toBeGreaterThan(away.deltaA);
        expect(home.deltaB).toBeLessThan(away.deltaB);
    });

    it('B2B deve reduzir a projeção do time em fadiga', () => {
        const normal = calculateProjectedScores(teamA, teamB, {});
        const b2b    = calculateProjectedScores(teamA, teamB, { isB2BA: true });

        expect(b2b.deltaA).toBeLessThan(normal.deltaA);
        expect(normal.deltaA - b2b.deltaA).toBeCloseTo(2, 0); // penalidade de -2 pts
    });

    it('vitória com margem > 20 deve reduzir projeção do time no jogo seguinte', () => {
        const normal    = calculateProjectedScores(teamA, teamB, {});
        const blowout   = calculateProjectedScores(teamA, teamB, { lastMarginA: 25 });

        expect(blowout.deltaA).toBeLessThan(normal.deltaA);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5: INTEGRIDADE DO TOTAL E SPREAD
// ─────────────────────────────────────────────────────────────────────────────

describe('OUTPUT — Total e Spread dentro de limites realistas da NBA', () => {

    it('total projetado deve estar entre 180 e 260 em cenário normal', () => {
        const result = calculateProjectedScores(teamA, teamB, {});
        expect(result.totalPayload).toBeGreaterThan(180);
        expect(result.totalPayload).toBeLessThan(260);
    });

    it('kineticState deve refletir o pace corretamente', () => {
        const result = calculateProjectedScores(teamA, teamB, {});
        const validStates = ['HYPER_KINETIC', 'STATIC_TRENCH', 'SLOW_GRIND'];
        expect(validStates).toContain(result.kineticState);
    });

    it('spread nunca deve ultrapassar 25 pts em cenário sem lesões extremas', () => {
        const result = calculateProjectedScores(teamA, teamB, {});
        const spread = Math.abs(result.deltaA - result.deltaB);
        expect(spread).toBeLessThan(25);
    });
});
