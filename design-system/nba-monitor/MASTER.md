# Master

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** NBA Monitor
**Generated:** 2026-03-17
**Category:** Sports Analytics Dashboard

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable | NBA Reference |
|------|-----|--------------|---------------|
| Primary | `#1D428A` | `--color-primary` | NBA Blue (Jerry West logo) |
| Secondary | `#C8102E` | `--color-secondary` | NBA Red |
| Accent/Gold | `#FFD700` | `--color-accent` | Championship Gold/Spotlights |
| Background | `#0A0A0A` | `--color-background` | Deep Black (OLED) |
| Surface | `#141414` | `--color-surface` | Card backgrounds |
| Surface Elevated | `#1E1E1E` | `--color-surface-elevated` | Modals, dropdowns |
| Text Primary | `#FFFFFF` | `--color-text-primary` | Pure white |
| Text Secondary | `#A1A1AA` | `--color-text-secondary` | Zinc 400 |
| Success | `#22C55E` | `--color-success` | Green stats |
| Warning | `#F59E0B` | `--color-warning` | Amber alerts |

**Color Philosophy:** 
- Fundo preto profundo (OLED) com acentos nos três tons NBA
- Azul (#1D428A) para elementos de confiança/dados
- Vermelho (#C8102E) para alertas/destaques críticos
- Dourado (#FFD700) para campeões/estatísticas premium
- Alto contraste para legibilidade em telas OLED

### Typography

- **Heading Font:** Oswald (Bold, Condensed, Sporty)
- **Body Font:** Inter (Clean, Modern, Readable)
- **Accent Font:** Bebas Neue (Stats, Numbers, Athletic)
- **Mood:** Urban, athletic, high-energy, professional sports broadcast
- **Google Fonts:** [Oswald + Inter + Bebas Neue](https://fonts.google.com/share?selection.family=Oswald:wght@400;500;600;700|Inter:wght@400;500;600;700|Bebas+Neue)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Bebas+Neue&display=swap');
```

**Type Scale:**
```css
--font-hero: 4rem/1 'Oswald', sans-serif;        /* Page titles */
--font-h1: 2.5rem/1.1 'Oswald', sans-serif;      /* Section headers */
--font-h2: 1.75rem/1.2 'Oswald', sans-serif;     /* Card titles */
--font-h3: 1.25rem/1.3 'Inter', sans-serif;      /* Subsection */
--font-body: 1rem/1.6 'Inter', sans-serif;       /* Body text */
--font-small: 0.875rem/1.5 'Inter', sans-serif;  /* Captions */
--font-stats: 2rem/1 'Bebas Neue', sans-serif;   /* Numbers, scores */
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps, inline elements |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, compact spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Card padding |
| `--space-xl` | `32px` / `2rem` | Section gaps |
| `--space-2xl` | `48px` / `3rem` | Major sections |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Effects & Shadows

**Glow Effects (NBA Spotlight Style):**
```css
--glow-blue: 0 0 20px rgba(29, 66, 138, 0.5);
--glow-red: 0 0 20px rgba(200, 16, 46, 0.5);
--glow-gold: 0 0 30px rgba(255, 215, 0, 0.4);
--glow-white: 0 0 15px rgba(255, 255, 255, 0.3);
```

**Shadow Depths:**
```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.5);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.6);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.7);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.8);
--shadow-glow-blue: var(--glow-blue);
```

**Metallic/Rust Texture (Subtle):**
```css
--texture-metallic: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%, rgba(255,255,255,0.02) 100%);
```

---

## Component Specs

### Buttons

```css
/* Primary Button - NBA Blue */
.btn-primary {
  background: linear-gradient(135deg, #1D428A 0%, #0F2656 100%);
  color: white;
  padding: 14px 28px;
  border-radius: 4px;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: var(--glow-blue);
  transition: all 200ms ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 500ms ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px rgba(29, 66, 138, 0.7);
}

.btn-primary:hover::before {
  left: 100%;
}

/* Secondary Button - NBA Red */
.btn-secondary {
  background: transparent;
  color: #C8102E;
  border: 2px solid #C8102E;
  padding: 12px 26px;
  border-radius: 4px;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: rgba(200, 16, 46, 0.1);
  box-shadow: var(--glow-red);
  transform: translateY(-1px);
}

/* Accent Button - Championship Gold */
.btn-accent {
  background: linear-gradient(135deg, #FFD700 0%, #B8860B 100%);
  color: #0A0A0A;
  padding: 14px 28px;
  border-radius: 4px;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: none;
  box-shadow: var(--glow-gold);
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-accent:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.6);
}
```

### Cards

```css
.card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: var(--shadow-md);
  transition: all 300ms ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
  opacity: 0;
  transition: opacity 300ms ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg), var(--glow-blue);
  border-color: rgba(29, 66, 138, 0.3);
}

.card:hover::after {
  opacity: 1;
}

/* Stats Card - Special variant */
.card-stats {
  background: linear-gradient(135deg, #141414 0%, #0F0F0F 100%);
  border-left: 3px solid var(--color-accent);
}

.card-stats .stat-number {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 3rem;
  color: var(--color-accent);
  text-shadow: var(--glow-gold);
  letter-spacing: 0.02em;
}
```

### Inputs

```css
.input {
  background: #0F0F0F;
  color: white;
  padding: 14px 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  transition: all 200ms ease;
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 66, 138, 0.2), var(--glow-blue);
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
}

.modal {
  background: linear-gradient(135deg, #1E1E1E 0%, #141414 100%);
  border-radius: 8px;
  padding: 32px;
  box-shadow: var(--shadow-xl), var(--glow-blue);
  max-width: 500px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #C8102E, #1D428A, #FFD700);
}
```

### Badges & Tags

```css
.badge-live {
  background: #C8102E;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  animation: pulse-live 2s infinite;
  box-shadow: var(--glow-red);
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.badge-team {
  background: rgba(29, 66, 138, 0.2);
  color: #60A5FA;
  border: 1px solid rgba(29, 66, 138, 0.3);
  padding: 6px 14px;
  border-radius: 4px;
  font-family: 'Oswald', sans-serif;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.875rem;
}
```

---

## Style Guidelines

**Style:** NBA Dark Mode (OLED Optimized)

**Keywords:** Championship energy, urban sports, high contrast, spotlight effects, metallic accents, athletic typography, court lines, arena lighting

**Best For:** Sports analytics, live scores, player stats, game tracking, fantasy sports

**Key Effects:** 
- **Spotlight Glow**: text-shadow e box-shadow nos tons NBA
- **Court Lines**: Bordas sutis inspiradas em linhas de quadra
- **Arena Lighting**: Gradientes que simulam iluminação de estádio
- **Metallic Texture**: Gradientes sutis para profundidade
- **Motion**: Transições rápidas (200ms) para energia dinâmica

### Page Pattern

**Pattern Name:** Sports Command Center

- **CTA Placement:** Above fold, sticky header on scroll
- **Section Order:** Hero Stats > Live Games > Player Spotlight > Analytics > CTA
- **Grid:** Asymmetric grid com cards de tamanhos variados (destaque para jogos ao vivo)

---

## Anti-Patterns (Do NOT Use)

- ❌ Light mode default (manter dark para autenticidade NBA)
- ❌ Slow rendering (manter < 60fps para experiência premium)
- ❌ Emojis como ícones (usar SVG customizados ou Lucide)
- ❌ `cursor:pointer` ausente em elementos clicáveis
- ❌ Layout-shifting em hovers (usar transformações GPU-accelerated)
- ❌ Texto com baixo contraste (mínimo 4.5:1, preferir 7:1)
- ❌ Mudanças de estado instantâneas (transições 150-300ms obrigatórias)
- ❌ Estados de foco invisíveis (navegação por teclado essencial)
- ❌ Cores que não respeitem a identidade NBA (manter azul/vermelho/dourado)

---

## Pre-Delivery Checklist

- [ ] Cores seguem paleta NBA (Azul #1D428A, Vermelho #C8102E, Dourado #FFD700)
- [ ] Tipografia: Oswald para headings, Inter para body, Bebas Neue para números
- [ ] Fundo escuro OLED (#0A0A0A) com superfícies em #141414
- [ ] Efeitos de glow nos tons NBA aplicados em cards e botões
- [ ] Ícones em SVG (sem emojis)
- [ ] `cursor-pointer` em todos elementos interativos
- [ ] Hover states com transições suaves (200-300ms)
- [ ] Contraste de texto verificado (mínimo 4.5:1)
- [ ] Estados de foco visíveis para acessibilidade
- [ ] `prefers-reduced-motion` respeitado
- [ ] Responsivo: 375px, 768px, 1024px, 1440px
- [ ] Nenhum conteúdo escondido por navbars fixas
- [ ] Sem scroll horizontal em mobile