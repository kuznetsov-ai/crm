# iDev UI Kit — Design Spec
Date: 2026-04-12

## Summary

Shared design system for all iDev projects, extracted from i-develop.tech. CSS custom properties + Tailwind preset + React components. Dark and light themes. Lives in `/iDev/idev-ui`.

---

## Decisions Made

| Question | Decision |
|---|---|
| Format | CSS custom properties + Tailwind preset (no npm registry needed) |
| Themes | Both dark AND light, switchable via `data-theme` on `<html>` |
| Location | `/iDev/idev-ui` — separate folder, independent of all projects |
| Scope | idev-hr, idev-hr-demo, idev-website, ESS (Django) |

---

## 1. Design Tokens

### Colors (from i-develop.tech)

```css
/* Shared across both themes */
--accent:        #fd7448;   /* coral orange — primary CTA */
--accent-hover:  #eb633d;   /* darker orange on hover */
--success:       #4ade80;   /* green */
--warning:       #facc15;   /* yellow */
--danger:        #f87171;   /* red */
--info:          #60a5fa;   /* blue */

/* Light theme */
--bg:            #ffffff;
--surface:       #f5f5f5;
--surface-2:     #ebebeb;
--border:        #e5e5e5;
--text:          #111111;
--text-muted:    #666666;

/* Dark theme */
--bg:            #1a191e;
--surface:       #2d2d2d;
--surface-2:     #383838;
--border:        #3d3d3d;
--text:          #fefefe;
--text-muted:    #999999;
```

### Typography

- **Font**: Montserrat (Google Fonts) — headings and UI labels
- **Fallback**: system-ui, sans-serif — body text
- **Weights used**: 400 (body), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)

### Shape & Spacing

```css
--r-lg:       30px;   /* large cards, hero sections */
--r-md:       20px;   /* panels, modals */
--r-sm:       12px;   /* inputs, small cards */
--r-pill:     9999px; /* buttons, badges */
--container:  min(1200px, calc(100% - 48px));
```

---

## 2. Theme Switching

Theme is controlled by `data-theme="dark|light"` attribute on `<html>`. Default is `light` (CSS `:root` fallback). User preference persisted in `localStorage('idev-theme')`.

```css
:root, [data-theme="light"] { --bg: #fff; ... }
[data-theme="dark"]          { --bg: #1a191e; ... }
```

Components use only CSS variables — they are theme-agnostic.

---

## 3. File Structure

```
/iDev/idev-ui/
├── tokens/
│   ├── tokens.css           # All CSS custom properties
│   └── tailwind.preset.js   # Tailwind v4 theme extension
├── components/
│   ├── Button.tsx            # primary | outline | ghost | danger + sizes
│   ├── Badge.tsx             # status colors: orange|green|yellow|blue|red|gray
│   ├── StatCard.tsx          # metric widget: value + label + optional trend
│   ├── DataTable.tsx         # sortable, with badge support in cells
│   └── Input.tsx             # text input + search variant
├── theme/
│   └── ThemeToggle.tsx       # toggle button + localStorage persistence
├── index.ts                  # barrel export
├── docs/
│   ├── brandbook.html        # visual brandbook (this file, always openable)
│   └── superpowers/specs/    # design specs
└── README.md
```

---

## 4. Integration per Project

### idev-hr / idev-hr-demo (Next.js + Tailwind)
```js
// tailwind.config.ts
import idevPreset from '../../idev-ui/tokens/tailwind.preset.js'
export default { presets: [idevPreset] }
```
```tsx
// layout.tsx — import components directly (relative path)
import { Button, Badge, StatCard } from '../../idev-ui/components'
```
```tsx
// layout.tsx — wrap with ThemeToggle
import { ThemeToggle } from '../../idev-ui/theme/ThemeToggle'
```

### idev-website (Vanilla HTML)
```html
<link rel="stylesheet" href="../../idev-ui/tokens/tokens.css">
```
Already has its own CSS — tokens.css supplements it, website CSS overrides where needed.

### ESS (Django)
```python
# settings.py
STATICFILES_DIRS = [BASE_DIR / '../../idev-ui/tokens']
```
```html
{% load static %}
<link rel="stylesheet" href="{% static 'tokens.css' %}">
```

---

## 5. Components Spec

### Button
Props: `variant` (primary|outline|ghost|danger), `size` (sm|md|lg), `disabled`, `loading`
- primary: `--accent` bg, white text, pill radius
- outline: transparent bg, `--accent` border+text
- ghost: `--surface` bg, `--text-muted` text
- danger: `--danger` tinted bg, `--danger` text

### Badge
Props: `color` (orange|green|yellow|blue|red|gray), `size` (sm|md)
- Pill shape, colors adapt automatically to current theme via CSS vars

### StatCard
Props: `value`, `label`, `color?` (defaults to `--accent`), `trend?` (up|down|neutral)
- Montserrat 800 for value, uppercase caption for label

### DataTable
Props: `columns`, `rows`, `sortable?`
- Sticky header, alternating row hover
- Supports Badge/Button as cell renderer

### Input
Props: `placeholder`, `value`, `onChange`, `variant` (default|search)
- search variant: magnifier icon prepended
- Focus ring uses `--accent`

### ThemeToggle
- Sun/moon icon button
- On mount: reads `localStorage('idev-theme')`, applies to `<html>`
- On click: toggles, saves to localStorage

---

## 6. Out of Scope (v1)

- Storybook / component documentation site
- npm publishing / GitHub Packages
- Modal, Dropdown, Tooltip, Toast components (v2)
- i18n support
- Animation tokens

---

## Acceptance Criteria

- [ ] `tokens.css` imported in idev-hr with no visual regressions
- [ ] Dark/light toggle works in idev-hr
- [ ] All 5 components render correctly in both themes
- [ ] `brandbook.html` opens at `file://` with no external dependencies broken
- [ ] idev-website links tokens.css without breaking existing styles

---

## Паттерны применения (v1.1 — обновлено 2026-04-13)

### 1. Фон страниц — всегда `var(--bg)`
```tsx
// ✅
<div className="min-h-screen bg-[var(--bg)]">
// ❌ даёт видимую светлую полосу в тёмной теме
<div className="min-h-screen bg-[var(--surface)]">
```

### 2. Скилл-теги — оранжевые
```tsx
// ✅ видны на любом фоне (light + dark)
<span className="bg-[var(--accent-soft)] text-[var(--accent)] rounded px-1.5 py-0.5 text-[10px]">
// ❌ невидимы в dark
<span className="bg-[var(--surface-2)] text-[var(--text-subtle)]">
```

### 3. Делители строк таблиц
```tsx
// ✅
<tbody className="divide-y divide-[var(--border)]">
// ❌ белые полосы в тёмной теме
<tbody className="divide-y divide-gray-200">
```

### 4. Запрещённые цвета — заменять на CSS vars
| Запрещено | Замена |
|---|---|
| `bg-blue-50` | `bg-[var(--info-soft)]` |
| `bg-green-50` | `bg-[var(--success-soft)]` |
| `bg-orange-50` | `bg-[var(--accent-soft)]` |
| `bg-red-50` | `bg-[var(--danger-soft)]` |
| `bg-yellow-50` | `bg-[var(--warning-soft)]` |
| `bg-gray-50/100/200` | `bg-[var(--surface)]` / `bg-[var(--surface-2)]` |
| `divide-gray-*` | `divide-[var(--border)]` |

### 5. Next.js — тема без flash
```tsx
// layout.tsx — обязательно
<html suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
  </head>
  <body style={{ background: 'var(--bg)', color: 'var(--text)' }}>
    // inline style вместо Tailwind-класса — реагирует на runtime theme change
  </body>
</html>
```

### 6. Компоненты из idev-ui — inline styles вместо Tailwind
Компоненты пакета idev-ui используют `style={{}}` вместо Tailwind-классов,
так как Tailwind не сканирует файлы вне проекта.
```tsx
// ✅ StatCard, Badge — inline CSS vars
style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
// ❌ Tailwind-классы в idev-ui не будут сгенерированы в CSS проекта
className="bg-surface rounded-sm"
```
