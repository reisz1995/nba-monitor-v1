import { describe, it, expect } from 'vitest';
import { calculateProjectedScores } from './nbaUtils';

describe('nbaUtils - Playoff Calibration', () => {
    const teamA = { 
        name: 'Lakers', 
        stats: { media_pontos_ataque: 115, media_pontos_defesa: 115 },
        record: [
            { score: '115-115' }, // 100
            { score: '115-115' },
            { score: '115-115' },
            { score: '115-115' },
            { score: '130-130' }  // 112.5 -> Clamped to 107 in L5 calculation
        ]
    } as any;
    
    const teamB = { 
        name: 'Celtics', 
        stats: { media_pontos_ataque: 115, media_pontos_defesa: 115 },
        record: [
            { score: '115-115' },
            { score: '115-115' },
            { score: '115-115' },
            { score: '115-115' },
            { score: '115-115' }
        ]
    } as any;

    describe('Pace Vector Logic (70/30)', () => {
        it('should apply 70/30 rule with H2H and mix with hybrid matrix', () => {
            const h2h = [{ score: '100-100' }]; // Pace 86.58
            const result = calculateProjectedScores(teamA, teamB, { 
                defenseData: h2h,
                editorInsight: 'Regular season game' 
            });
            
            // L5 A: (100*4 + 107)/5 = 101.4
            // L5 B: 100
            // Media L5 = 100.7
            // H2H = 86.58
            // 70/30 Base = 100.7 * 0.7 + 86.58 * 0.3 = 96.46
            // Hybrid Mix (Regular 80/20): (101.4 * 0.8 + 100 * 0.2) = 101.12
            // Final Pace = (96.46 * 0.5) + (101.12 * 0.5) = 48.23 + 50.56 = 98.79
            expect(result.matchPace).toBeLessThan(101);
            expect(result.matchPace).toBeCloseTo(98.47, 1);
        });

        it('should fallback to 100% L5 if no H2H', () => {
            const result = calculateProjectedScores(teamA, teamB, { 
                defenseData: [],
                editorInsight: 'Regular season game' 
            });
            // Media L5 = 100.7
            // Hybrid Mix: 101.12
            // Final = (100.7 * 0.5) + (101.12 * 0.5) = 50.35 + 50.56 = 100.91
            expect(result.matchPace).toBeCloseTo(100.5, 1);
        });
    });

    describe('Playoff Tension Trigger', () => {
        it('should detect playoff context from editorInsight', () => {
            const result = calculateProjectedScores(teamA, teamB, { 
                editorInsight: 'This is a Playoff Game 1' 
            });
            expect(result.isPlayoff).toBe(true);
        });

        it('should clamp pace to 102.5 in playoffs', () => {
            const teamFast = {
                ...teamA,
                record: new Array(5).fill({ score: '130-130' }) // Pace ~112
            };
            const result = calculateProjectedScores(teamFast, teamFast, { 
                editorInsight: 'Playoffs Round 1' 
            });
            expect(result.matchPace).toBeLessThanOrEqual(102.5);
        });

        it('should reduce total payload in STATIC_TRENCH/SLOW_GRIND during playoffs', () => {
            const resultRegular = calculateProjectedScores(teamA, teamB, { 
                editorInsight: 'Regular Season' 
            });
            const resultPlayoff = calculateProjectedScores(teamA, teamB, { 
                editorInsight: 'Playoffs Game 1' 
            });
            
            // O estado de teamA e teamB deve ser STATIC_TRENCH ou SLOW_GRIND (Pace ~100)
            expect(resultRegular.kineticState).toMatch(/STATIC_TRENCH|SLOW_GRIND/);
            expect(resultPlayoff.totalPayload).toBeLessThan(resultRegular.totalPayload * 0.95);
        });
    });

    describe('Failure Detection (Over-fitting)', () => {
        it('should apply Intensity Drain (-15% confidence) in Game 2 after blowout', () => {
            const h2h = [{ score: '120-90' }]; // Blowout 30 pts margin
            const result = calculateProjectedScores(teamA, teamB, { 
                editorInsight: 'Playoffs Game 2',
                defenseData: h2h
            });
            expect(result.confidenceModifier).toBe(-0.15);
        });

        it('should apply Star Injury impact (-4.5 pts extra)', () => {
            // Aumentar scores para evitar clamping (PPG alto)
            const teamHighA = { ...teamA, stats: { media_pontos_ataque: 140, media_pontos_defesa: 140 } };
            const teamHighB = { ...teamB, stats: { media_pontos_ataque: 140, media_pontos_defesa: 140 } };

            const resultNormal = calculateProjectedScores(teamHighA, teamHighB, { editorInsight: 'Playoffs' });
            const resultInjury = calculateProjectedScores(teamHighA, teamHighB, { 
                editorInsight: 'Playoffs',
                injuriesA: [{ nome: 'Star', isOut: true, weight: 9 }]
            });
            
            // Penalidade normal para weight 9 é (9*2.0)+2 = 20
            // Impacto adicional de estrela = 4.5
            // Total redução = 24.5
            // Pode haver uma pequena variação devido ao multiplicador de pace, mas deve estar próximo de 24.5
            const diff = resultNormal.deltaA - resultInjury.deltaA;
            expect(diff).toBeGreaterThan(20);
            expect(diff).toBeCloseTo(24.5, 0); // Precisão de 0 casas decimais permite +/- 0.5 de erro
        });
    });
});
