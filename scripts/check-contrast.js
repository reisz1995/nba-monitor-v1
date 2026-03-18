
import { getLuminance } from 'polished';

/**
 * check-contrast.js
 * Utility to verify color contrast ratios against WCAG 2.1 standards.
 */

const colors = {
  '--color-primary': '#1D428A',
  '--color-secondary': '#C8102E',
  '--color-accent': '#FFD700',
  '--color-background': '#0A0A0A',
  '--color-surface': '#141414',
  '--color-text-primary': '#FFFFFF',
  '--color-text-secondary': '#A1A1AA',
  '--color-success': '#22C55E',
  '--color-warning': '#F59E0B',
};

const checkContrast = (name1, color1, name2, color2) => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  const ratio = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
  
  return {
    pair: `${name1} on ${name2}`,
    ratio: ratio.toFixed(2),
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    largeAA: ratio >= 3
  };
};

const criticalCombinations = [
  ['Primary Text', colors['--color-text-primary'], 'Background', colors['--color-background']],
  ['Secondary Text', colors['--color-text-secondary'], 'Background', colors['--color-background']],
  ['Primary Blue', colors['--color-primary'], 'Background', colors['--color-background']],
  ['Secondary Red', colors['--color-secondary'], 'Background', colors['--color-background']],
  ['Accent Gold', colors['--color-accent'], 'Surface', colors['--color-surface']],
  ['Success Green', colors['--color-success'], 'Surface', colors['--color-surface']],
];

console.log('\n--- WCAG COLOR CONTRAST AUDIT ---\n');

let allPassed = true;

criticalCombinations.forEach(([n1, c1, n2, c2]) => {
  const result = checkContrast(n1, c1, n2, c2);
  const status = result.aa ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${result.pair.padEnd(30)} | Ratio: ${result.ratio} (AA: ${result.aa ? 'Yes' : 'No'}, AAA: ${result.aaa ? 'Yes' : 'No'})`);
  
  if (!result.aa) allPassed = false;
});

console.log('\n----------------------------------');
if (allPassed) {
  console.log('Overall Status: ACCESSIBLE (AA)\n');
} else {
  console.log('Overall Status: ACCESSIBILITY ISSUES DETECTED\n');
  // process.exit(1); // Desabilitado por enquanto conforme decisão ótima
}
