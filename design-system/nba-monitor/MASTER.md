# NBA Monitor v1 | Design System Master

> **LOGIC:** This Master file defines the global DNA. Specific page overrides in `design-system/pages/[page-name].md` take precedence.

---

**Project:** NBA Monitor v1
**Theme:** Premium Hybrid (Modern Brutalist + Glassmorphism)
**Vibe:** Technical, Data-Dense, High-End Financial Dashboard
**OLED Ready:** Yes (Deep Black Primary Background)

---

## 🎨 Core Design Tokens

### Color Palette (OLED High-Contrast)

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| **Backdrop** | `#000000` | `--bg-pure` | Root background for OLED efficiency |
| **Surface** | `#0A0A0A` | `--bg-surface` | Primary card and panel surface |
| **Glass** | `rgba(255,255,255,0.03)` | `--bg-glass` | Frosted overlays and translucent borders |
| **Primary** | `#6366F1` | `--indigo-500` | Selection, active momentum, focus |
| **Accent** | `#F97316` | `--orange-500` | CTA, Alerts, Matchup Favorite |
| **Success** | `#10B981` | `--emerald-500` | "Green" outcomes, positive HW |
| **Danger** | `#F43F5E` | `--rose-500` | "Red" outcomes, medical logs, OUT status |
| **Warning** | `#F59E0B` | `--amber-500` | Day-to-Day status, zebra alerts |
| **Text Main** | `#F8FAFC` | `--text-primary` | High readability headers |
| **Text Sub** | `#64748B` | `--text-secondary` | Data labels, metadata, "Ghost" text |

### Typography

- **Data/Technical:** `Space Mono` (Monospace for numbers, status codes, and headers).
- **Body/UI:** `Inter` or `Outfit` (Sans-serif for readability and long descriptions).
- **Styling:** Bold weights (700+) for headers; Monospace strictly for tabular data.
- **Import:**
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Mono:wght@400;700&display=swap');
  ```

### FX & Glassmorphism

| Token | Value | Usage |
|-------|-------|-------|
| `--glass-blur` | `blur(12px)` | Panel backgrounds |
| `--glass-border` | `1px solid rgba(255,255,255,0.1)` | Subtle separation |
| `--sharp-shadow` | `8px 8px 0px rgba(0,0,0,1)` | Brutalist card depth |
| `--glow-primary` | `0 0 20px rgba(99, 102, 241, 0.3)` | Active elements |

---

## 🤖 AI & Logic Metrics Integration

Standardized definitions for the "Estatístico Chefe" Engine.

### 1. AI Score (Power Ranking)
- **Scale:** 2.0 to 5.0.
- **Visual:** Small badge with black background and white border.
- **Rules:** 
  - `> 4.5`: Elite (absorbs injuries better).
  - `< 3.0`: Vulnerable (injuries cause drastic collapse).

### 2. HW (Handicap de Estrela)
- **Logic:** `floor(PTS / 3)`.
- **Purpose:** Quantifies "Star Power".
- **Visual:** Displayed in `Space Mono` next to player names in comparison panels.
- **Coloring:** Emerald for active stars, Rose for OUT stars (penalty).

### 3. Expected Points (Matriz de Eficiência Cruzada)
- **Logic:** `(OffA + DefB) / 2`.
- **Visual:** Massive typography (7xl+) to communicate "Mathematical Truth".
- **Override:** Defensive Rating can "compress" (Under) or "expand" (Over) this baseline.

---

## 🧱 Component Blueprint

### Brutalist Cards
```css
.card-brutalist {
  background: var(--bg-surface);
  border: 4px solid white;
  box-shadow: 12px 12px 0px #000;
  transition: transform 200ms ease;
}
.card-brutalist:hover {
  transform: translate(-4px, -4px);
  box-shadow: 16px 16px 0px #000;
}
```

### Glass Tables
```css
.table-glass {
  background: var(--bg-glass);
  backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  border-radius: 8px;
}
```

---

## 🚫 Anti-Patterns (Forbidden)

- ❌ **Rounding technical data:** Never round `ai_score` or `HW` to 0 decimals. Use `.1`.
- ❌ **Emojis as symbols:** Use `Lucide` or inline `SVG`. Emojis break the technical aesthetic.
- ❌ **Implicit Focus:** Active or focused elements MUST have a visible border or glow.
- ❌ **Soft Gradients:** Use solid steps or high-contrast linear transitions (Brutalist style).

---

## 🏁 Final Audit Checklist

- [ ] All clickable items have `cursor-pointer`.
- [ ] `Space Mono` used for EVERY numeric value.
- [ ] Medical impact (Penalties) clearly highlighted in `Rose-500`.
- [ ] Layout density optimized (no wasted whitespace).
- [ ] Responsive states verified (375px to 1440px).

