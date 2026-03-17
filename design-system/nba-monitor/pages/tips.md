# Tips

> **PROJECT:** NBA Monitor
> **Generated:** 2026-03-17
> **Page Type:** Sports Analytics / Betting Insights Dashboard

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px (mais largo para tabelas de dados)
- **Layout:** Grid assimétrico com cards de destaque para "Hot Tips"
- **Background Pattern:** Subtle court lines pattern (SVG) com opacidade 0.03

### Spacing Overrides

- **Section Gap:** 48px (mais respiro entre seções de análise)
- **Card Padding:** 28px (mais conteúdo por card)
- **Stats Grid Gap:** 12px (compacto para densidade de dados)

### Typography Overrides

- **Stats Numbers:** Bebas Neue em 2.5rem para odds e probabilidades
- **Tips Headers:** Oswald 700 com letter-spacing 0.02em
- **Confidence Score:** Bebas Neue 3rem com cor dourada (#FFD700)

### Color Overrides

- **Hot Tip Card:** Gradiente sutil de #1D428A para #0F2656 com borda dourada
- **Confidence High:** #FFD700 (Gold) + glow dourado
- **Confidence Medium:** #60A5FA (Blue-400)
- **Confidence Low:** #A1A1AA (Zinc-400)
- **Win Streak:** #22C55E (Green) com glow verde
- **Loss Streak:** #C8102E (Red) com glow vermelho

### Component Overrides

**Tip Card Especial:**
```css
.tip-card-featured {
  background: linear-gradient(135deg, #141414 0%, #0A0A0A 100%);
  border: 2px solid transparent;
  border-image: linear-gradient(135deg, #FFD700, #1D428A, #C8102E) 1;
  position: relative;
  overflow: hidden;
}

.tip-card-featured::before {
  content: 'HOT TIP';
  position: absolute;
  top: 12px;
  right: -30px;
  background: #C8102E;
  color: white;
  padding: 4px 40px;
  font-family: 'Oswald', sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transform: rotate(45deg);
  box-shadow: var(--glow-red);
}

.confidence-meter {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.confidence-meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #1D428A, #FFD700);
  box-shadow: var(--glow-gold);
  transition: width 500ms ease;
}

.odds-display {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 2rem;
  color: #FFD700;
  text-shadow: var(--glow-gold);
  letter-spacing: 0.05em;
}
```

---

## Page-Specific Components

**Team Matchup Bar:**
```css
.matchup-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  padding: 20px 24px;
  border-radius: 8px;
  border-left: 4px solid var(--color-primary);
}

.team-side {
  display: flex;
  align-items: center;
  gap: 16px;
}

.vs-divider {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--color-secondary);
  text-shadow: var(--glow-red);
  position: relative;
}

.vs-divider::before,
.vs-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 20px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-secondary));
}

.vs-divider::before { right: 100%; margin-right: 8px; }
.vs-divider::after { left: 100%; margin-left: 8px; background: linear-gradient(90deg, var(--color-secondary), transparent); }
```

**Trend Indicator:**
```css
.trend-up {
  color: #22C55E;
  text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Bebas Neue', sans-serif;
}

.trend-down {
  color: #C8102E;
  text-shadow: var(--glow-red);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'Bebas Neue', sans-serif;
}
```

---

## Recommendations

- **Efeitos:** 
  - Glow dourado em tips com confiança > 80%
  - Spotlight azul em cards ao passar o mouse
  - Animação de "pulse" em odds ao vivo
  - Transições rápidas (150ms) para manter energia esportiva
  
- **Dados Visuais:**
  - Usar heatmaps com gradiente azul → vermelho para estatísticas
  - Barras de confiança com gradiente dourado
  - Números grandes (Bebas Neue) para odds e probabilidades
  
- **Contexto NBA:**
  - Cores dos times quando disponíveis (usar dados de times)
  - Ícones de bola de basquete customizados (SVG)
  - Layout inspirado em broadcast de jogos (ESPN, TNT)
```

---

## Resumo das Mudanças Principais

| Aspecto | Antes (Genérico) | Depois (NBA) |
|---------|-----------------|--------------|
| **Cores** | Azul #3B82F6, Laranja #F97316 | Azul NBA #1D428A, Vermelho #C8102E, Dourado #FFD700 |
| **Fundo** | #F8FAFC (claro) | #0A0A0A (OLED black) |
| **Fonte** | Space Mono (monospace) | Oswald + Inter + Bebas Neue (sporty) |
| **Estilo** | Brutalist/Technical | Urban Sports/Arena |
| **Efeitos** | Sombras sutis | Glow effects, spotlights, metallic |
| **Botões** | Bordas arredondadas | Cantos levemente arredondados, uppercase, tracking |
| **Cards** | Sombra simples | Bordas luminosas, gradientes, glow |

A identidade agora reflete a energia da NBA: **escura e premium** (OLED), com **acentos nos três tons clássicos** (azul, vermelho, branco) e **dourado para destaque de campeões**, usando **tipografia esportiva** que remete a broadcast de jogos e flyers urbanos.