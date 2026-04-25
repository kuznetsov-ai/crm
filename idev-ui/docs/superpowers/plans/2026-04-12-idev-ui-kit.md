# iDev UI Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared CSS design system (`/iDev/idev-ui`) extracted from i-develop.tech and apply it to idev-hr with dark/light theme switching.

**Architecture:** CSS custom properties in `tokens.css` define all design tokens. A Tailwind v4 preset extends them into utility classes. Five React components (Button, Badge, StatCard, DataTable, Input) plus a ThemeToggle consume only CSS variables — they are theme-agnostic. idev-hr imports the preset and components via relative path. idev-website links `tokens.css` directly.

**Tech Stack:** CSS custom properties, Tailwind v4 (`@theme inline`), React/TypeScript, Next.js 16 App Router, Google Fonts (Montserrat)

---

## File Map

**New files in `/iDev/idev-ui/`:**
- `tokens/tokens.css` — all CSS custom properties (colors, typography, shape, spacing)
- `tokens/tailwind.preset.js` — Tailwind v4 theme extension from tokens
- `components/Button.tsx` — primary | outline | ghost | danger × sm | md | lg
- `components/Badge.tsx` — status colors × sm | md
- `components/StatCard.tsx` — metric widget: value + label + optional color
- `components/DataTable.tsx` — sortable table with badge cell support
- `components/Input.tsx` — text input + search variant
- `theme/ThemeToggle.tsx` — dark/light toggle with localStorage
- `index.ts` — barrel export

**Modified in `/iDev/idev-hr/`:**
- `src/app/globals.css` — import tokens.css, remove old :root vars
- `src/app/layout.tsx` — add Montserrat font, add ThemeToggle, add `data-theme` init script
- `src/app/page.tsx` — replace hardcoded colors with CSS var classes (StatCard)
- `src/app/candidates/page.tsx` — replace inline styles with Badge component

**Modified in `/iDev/idev-website/`:**
- `css/main.css` (or `index.html`) — add `<link>` to tokens.css

---

## Task 1: CSS Tokens

**Files:**
- Create: `tokens/tokens.css`

- [ ] **Step 1: Create tokens.css**

```css
/* /iDev/idev-ui/tokens/tokens.css */

/* ── Shared (both themes) ── */
:root {
  --accent:         #fd7448;
  --accent-hover:   #eb633d;
  --accent-soft:    rgba(253, 116, 72, 0.12);
  --success:        #4ade80;
  --success-soft:   rgba(74, 222, 128, 0.12);
  --warning:        #facc15;
  --warning-soft:   rgba(250, 204, 21, 0.10);
  --danger:         #f87171;
  --danger-soft:    rgba(239, 68, 68, 0.12);
  --info:           #60a5fa;
  --info-soft:      rgba(96, 165, 250, 0.12);

  --font-brand:     'Montserrat', system-ui, sans-serif;
  --font-body:      system-ui, -apple-system, sans-serif;

  --r-lg:           30px;
  --r-md:           20px;
  --r-sm:           12px;
  --r-pill:         9999px;

  --container:      min(1200px, calc(100% - 48px));

  --shadow-sm:      0 1px 3px rgba(0,0,0,.08);
  --shadow-md:      0 4px 12px rgba(0,0,0,.12);
  --shadow-lg:      0 8px 24px rgba(0,0,0,.16);

  --transition:     150ms ease;
}

/* ── Light theme (default) ── */
:root,
[data-theme="light"] {
  --bg:             #ffffff;
  --surface:        #f5f5f5;
  --surface-2:      #ebebeb;
  --border:         #e5e5e5;
  --border-strong:  #d0d0d0;
  --text:           #111111;
  --text-muted:     #666666;
  --text-subtle:    #999999;
  --nav-bg:         rgba(255,255,255,0.95);
}

/* ── Dark theme ── */
[data-theme="dark"] {
  --bg:             #1a191e;
  --surface:        #2d2d2d;
  --surface-2:      #383838;
  --border:         #3d3d3d;
  --border-strong:  #555555;
  --text:           #fefefe;
  --text-muted:     #999999;
  --text-subtle:    #666666;
  --nav-bg:         rgba(26,25,30,0.95);
}
```

- [ ] **Step 2: Verify file renders correctly**

Open `docs/brandbook.html` in browser — the color swatches should still look correct (the brandbook already embeds its own styles, this is just a sanity check that the file saved cleanly).

- [ ] **Step 3: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add tokens/tokens.css
git commit -m "feat: add CSS design tokens from i-develop.tech"
```

---

## Task 2: Tailwind Preset

**Files:**
- Create: `tokens/tailwind.preset.js`

- [ ] **Step 1: Create tailwind preset**

Tailwind v4 uses `@theme inline` in CSS — the preset is a JS config that maps CSS vars to Tailwind utilities.

```js
// /iDev/idev-ui/tokens/tailwind.preset.js

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        accent:       'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        success:      'var(--success)',
        warning:      'var(--warning)',
        danger:       'var(--danger)',
        info:         'var(--info)',
        bg:           'var(--bg)',
        surface:      'var(--surface)',
        'surface-2':  'var(--surface-2)',
        border:       'var(--border)',
        text:         'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
      },
      fontFamily: {
        brand: 'var(--font-brand)',
        body:  'var(--font-body)',
      },
      borderRadius: {
        lg:   'var(--r-lg)',
        md:   'var(--r-md)',
        sm:   'var(--r-sm)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add tokens/tailwind.preset.js
git commit -m "feat: add Tailwind v4 preset extending CSS tokens"
```

---

## Task 3: Button Component

**Files:**
- Create: `components/Button.tsx`

- [ ] **Step 1: Create Button.tsx**

```tsx
// /iDev/idev-ui/components/Button.tsx
import React from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-pill transition cursor-pointer border-none font-brand disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  outline: 'bg-transparent text-accent border border-accent hover:bg-accent-soft',
  ghost:   'bg-surface text-text-muted hover:bg-surface-2',
  danger:  'bg-[var(--danger-soft)] text-danger hover:opacity-80',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2 text-sm',
  lg: 'px-7 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add components/Button.tsx
git commit -m "feat: add Button component (primary|outline|ghost|danger)"
```

---

## Task 4: Badge Component

**Files:**
- Create: `components/Badge.tsx`

- [ ] **Step 1: Create Badge.tsx**

```tsx
// /iDev/idev-ui/components/Badge.tsx
import React from 'react';

type BadgeColor = 'orange' | 'green' | 'yellow' | 'blue' | 'red' | 'gray';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  color?: BadgeColor;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const colors: Record<BadgeColor, string> = {
  orange: 'bg-[var(--accent-soft)]   text-accent',
  green:  'bg-[var(--success-soft)]  text-success',
  yellow: 'bg-[var(--warning-soft)]  text-warning',
  blue:   'bg-[var(--info-soft)]     text-info',
  red:    'bg-[var(--danger-soft)]   text-danger',
  gray:   'bg-surface-2              text-text-muted',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  color = 'gray',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-block font-semibold rounded-pill font-brand ${colors[color]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}

/* Convenience: map Person status strings → badge colors */
export const STATUS_COLOR: Record<string, BadgeColor> = {
  ON_PROJECT:  'green',
  BENCH:       'orange',
  IN_FUNNEL:   'yellow',
  SCREENING:   'blue',
  LEFT:        'red',
  ARCHIVED:    'gray',
};
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add components/Badge.tsx
git commit -m "feat: add Badge component with STATUS_COLOR map"
```

---

## Task 5: StatCard Component

**Files:**
- Create: `components/StatCard.tsx`

- [ ] **Step 1: Create StatCard.tsx**

```tsx
// /iDev/idev-ui/components/StatCard.tsx
import React from 'react';

interface StatCardProps {
  value: string | number;
  label: string;
  color?: string;          // CSS color or var(), defaults to --accent
  trend?: 'up' | 'down' | 'neutral';
  hint?: string;           // tooltip text for ? icon
  className?: string;
}

export function StatCard({
  value,
  label,
  color = 'var(--accent)',
  trend,
  hint,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`bg-surface rounded-sm p-4 flex flex-col gap-1 ${className}`}
    >
      <div className="flex items-start justify-between">
        <span
          className="font-brand font-extrabold text-3xl leading-none"
          style={{ color }}
        >
          {value}
        </span>
        {hint && (
          <span
            title={hint}
            className="w-4 h-4 rounded-full bg-surface-2 text-text-subtle text-[10px] flex items-center justify-center cursor-help flex-shrink-0 mt-0.5"
          >
            ?
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {trend === 'up'   && <span className="text-success text-xs">↑</span>}
        {trend === 'down' && <span className="text-danger  text-xs">↓</span>}
        <span className="text-[10px] text-text-subtle uppercase tracking-wide font-brand">
          {label}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add components/StatCard.tsx
git commit -m "feat: add StatCard component"
```

---

## Task 6: Input Component

**Files:**
- Create: `components/Input.tsx`

- [ ] **Step 1: Create Input.tsx**

```tsx
// /iDev/idev-ui/components/Input.tsx
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'search';
  label?: string;
  error?: string;
}

export function Input({
  variant = 'default',
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  const base =
    'w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-text placeholder:text-text-subtle outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wide font-brand">
          {label}
        </label>
      )}
      <div className="relative">
        {variant === 'search' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
        )}
        <input
          className={`${base} ${variant === 'search' ? 'pl-9' : ''} ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add components/Input.tsx
git commit -m "feat: add Input component (default + search variants)"
```

---

## Task 7: DataTable Component

**Files:**
- Create: `components/DataTable.tsx`

- [ ] **Step 1: Create DataTable.tsx**

```tsx
// /iDev/idev-ui/components/DataTable.tsx
'use client';
import React, { useState } from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyText = 'Нет данных',
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = String(a[sortKey] ?? '');
        const bv = String(b[sortKey] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : rows;

  return (
    <div className={`bg-surface rounded-sm overflow-hidden border border-border ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-2.5 text-left text-[10px] font-semibold text-text-subtle uppercase tracking-wide font-brand whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-text select-none' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  {col.label}
                  {col.sortable && sortKey === String(col.key) && (
                    <span className="ml-1 text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-text-subtle text-sm">
                  {emptyText}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-surface-2 transition">
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-4 py-2.5 text-text">
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : String(row[col.key as keyof T] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add components/DataTable.tsx
git commit -m "feat: add DataTable component with sort support"
```

---

## Task 8: ThemeToggle Component

**Files:**
- Create: `theme/ThemeToggle.tsx`

- [ ] **Step 1: Create theme directory and ThemeToggle.tsx**

```bash
mkdir -p /Users/kuznetsov/Projects/iDev/idev-ui/theme
```

```tsx
// /iDev/idev-ui/theme/ThemeToggle.tsx
'use client';
import React, { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'idev-theme';
const DEFAULT_THEME: Theme = 'light';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = saved ?? DEFAULT_THEME;
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      onClick={toggle}
      className={`w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent transition ${className}`}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      aria-label="Переключить тему"
    >
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}
    </button>
  );
}

/* Script to inject into <head> to prevent flash on load */
export const themeInitScript = `(function(){
  var t = localStorage.getItem('${STORAGE_KEY}') || '${DEFAULT_THEME}';
  document.documentElement.setAttribute('data-theme', t);
})();`;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add theme/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle with localStorage persistence"
```

---

## Task 9: Barrel Export

**Files:**
- Create: `index.ts`

- [ ] **Step 1: Create index.ts**

```ts
// /iDev/idev-ui/index.ts
export { Button }       from './components/Button';
export { Badge, STATUS_COLOR } from './components/Badge';
export { StatCard }     from './components/StatCard';
export { DataTable }    from './components/DataTable';
export type { Column }  from './components/DataTable';
export { Input }        from './components/Input';
export { ThemeToggle, themeInitScript } from './theme/ThemeToggle';
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add index.ts
git commit -m "feat: add barrel export index.ts"
```

---

## Task 10: Apply to idev-hr — Tokens + Font + Theme

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update globals.css to import tokens**

Replace the entire content of `/Users/kuznetsov/Projects/iDev/idev-hr/src/app/globals.css`:

```css
/* idev-hr — globals.css */
@import "tailwindcss";
@import "./mobile.css";
/* iDev brand tokens */
@import "../../../idev-ui/tokens/tokens.css";

@theme inline {
  --color-accent:        var(--accent);
  --color-accent-hover:  var(--accent-hover);
  --color-accent-soft:   var(--accent-soft);
  --color-success:       var(--success);
  --color-success-soft:  var(--success-soft);
  --color-warning:       var(--warning);
  --color-warning-soft:  var(--warning-soft);
  --color-danger:        var(--danger);
  --color-danger-soft:   var(--danger-soft);
  --color-info:          var(--info);
  --color-info-soft:     var(--info-soft);
  --color-bg:            var(--bg);
  --color-surface:       var(--surface);
  --color-surface-2:     var(--surface-2);
  --color-border:        var(--border);
  --color-text:          var(--text);
  --color-text-muted:    var(--text-muted);
  --color-text-subtle:   var(--text-subtle);
  --font-brand:          var(--font-brand);
  --radius-sm:           var(--r-sm);
  --radius-md:           var(--r-md);
  --radius-lg:           var(--r-lg);
  --radius-pill:         var(--r-pill);
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  transition: background var(--transition), color var(--transition);
}
```

- [ ] **Step 2: Update layout.tsx — add Montserrat + ThemeToggle + no-flash script**

```tsx
// /Users/kuznetsov/Projects/iDev/idev-hr/src/app/layout.tsx
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeToggle, themeInitScript } from "../../../idev-ui/theme/ThemeToggle";

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "iDev HR",
  description: "HR-система iDevelop IT",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${montserrat.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run dev server and verify no crashes**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
npm run dev
```

Expected: `✓ Ready in ...ms` with no TypeScript errors.

Open http://localhost:3000 — page should render (may look different but must not crash).

- [ ] **Step 4: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: apply iDev brand tokens and Montserrat font"
```

---

## Task 11: Apply ThemeToggle to idev-hr Navigation

**Files:**
- Modify: whichever file renders the top nav (find with `grep -r "Дашборд\|dashboard\|nav" src/app --include="*.tsx" -l`)

- [ ] **Step 1: Find the nav component**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
grep -rl "Дашборд\|Кандидаты\|Партнёры" src/app --include="*.tsx" | head -5
```

- [ ] **Step 2: Add ThemeToggle to nav**

In the nav file, import and add ThemeToggle next to the logout button:

```tsx
import { ThemeToggle } from '../../../../idev-ui/theme/ThemeToggle';

// In the nav JSX, add next to existing controls:
<div className="flex items-center gap-2">
  <ThemeToggle />
  {/* existing logout button */}
</div>
```

- [ ] **Step 3: Verify toggle works**

Open http://localhost:3000, click the theme toggle — background should switch between `#ffffff` and `#1a191e`. Refresh the page — theme should persist.

- [ ] **Step 4: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
git add -A
git commit -m "feat: add ThemeToggle to idev-hr navigation"
```

---

## Task 12: Apply Badge to Candidates/Staff

**Files:**
- Modify: `src/app/candidates/page.tsx` (or whichever renders person status)

- [ ] **Step 1: Find status rendering**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
grep -rn "ON_PROJECT\|BENCH\|IN_FUNNEL\|status" src/app --include="*.tsx" | grep -v "node_modules" | head -10
```

- [ ] **Step 2: Replace inline status styles with Badge**

Find code that renders status like:
```tsx
<span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">На проекте</span>
```

Replace with:
```tsx
import { Badge, STATUS_COLOR } from '../../../../idev-ui/components/Badge';

// Usage:
<Badge color={STATUS_COLOR[person.status] ?? 'gray'}>
  {STATUS_LABELS[person.status] ?? person.status}
</Badge>
```

Where `STATUS_LABELS` maps enum → Russian label (add near the import):
```tsx
const STATUS_LABELS: Record<string, string> = {
  ON_PROJECT:  'На проекте',
  BENCH:       'Бенч',
  IN_FUNNEL:   'В воронке',
  SCREENING:   'Скрининг',
  LEFT:        'Ушёл',
  ARCHIVED:    'Архив',
};
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
git add -A
git commit -m "feat: use iDev Badge component for person status"
```

---

## Task 13: Apply StatCard to Dashboard

**Files:**
- Modify: `src/app/page.tsx` (dashboard)

- [ ] **Step 1: Find stat widgets**

```bash
grep -n "ВСЕГО ЛЮДЕЙ\|НА ПРОЕКТАХ\|totalPeople\|onProject" /Users/kuznetsov/Projects/iDev/idev-hr/src/app/page.tsx | head -10
```

- [ ] **Step 2: Replace stat widgets with StatCard**

Find the stat widget JSX (looks like a div with a big number and label). Replace with:

```tsx
import { StatCard } from '../../../../idev-ui/components/StatCard';

// Replace each widget:
<StatCard value={persons.length} label="Всего людей" />
<StatCard value={onProject} label="На проектах" color="var(--success)" />
<StatCard value={bench} label="Бенч" color="var(--warning)" />
```

- [ ] **Step 3: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
git add src/app/page.tsx
git commit -m "feat: use iDev StatCard on dashboard"
```

---

## Task 14: Apply tokens.css to idev-website

**Files:**
- Modify: `/Users/kuznetsov/Projects/iDev/idev-website/index.html`

- [ ] **Step 1: Add link to tokens.css in index.html `<head>`**

```html
<!-- Add BEFORE existing <link rel="stylesheet"> tags -->
<link rel="stylesheet" href="../idev-ui/tokens/tokens.css">
```

- [ ] **Step 2: Verify website still looks correct**

```bash
open /Users/kuznetsov/Projects/iDev/idev-website/index.html
```

The website already uses `--accent: #fd7448` and similar variables in its own CSS. The tokens.css values match exactly, so there should be no visual change. If any variable conflicts arise, the website's own CSS (loaded after) will win.

- [ ] **Step 3: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-website
git add index.html
git commit -m "feat: link iDev UI Kit tokens.css"
```

---

## Task 15: Final Screenshot + README

**Files:**
- Create: `README.md` in `/iDev/idev-ui/`

- [ ] **Step 1: Write README.md**

```md
# iDev UI Kit

Shared design system for all iDev projects, extracted from [i-develop.tech](https://i-develop.tech).

## Quick Start

### Next.js + Tailwind (idev-hr, idev-hr-demo)
In `globals.css`:
\`\`\`css
@import "../../../idev-ui/tokens/tokens.css";
\`\`\`
In `tailwind.config.ts`:
\`\`\`js
import idevPreset from '../../idev-ui/tokens/tailwind.preset.js'
export default { presets: [idevPreset] }
\`\`\`

### Vanilla HTML (idev-website)
\`\`\`html
<link rel="stylesheet" href="../idev-ui/tokens/tokens.css">
\`\`\`

### Django (ESS)
Copy `tokens/tokens.css` to `static/css/` or add path to `STATICFILES_DIRS`.

## Brandbook
Open `docs/brandbook.html` in any browser.

## Tokens
See `tokens/tokens.css` — all CSS custom properties.

## Components
`Button` · `Badge` · `StatCard` · `DataTable` · `Input` · `ThemeToggle`
```

- [ ] **Step 2: Take screenshot of idev-hr with new theme**

```bash
python3 -c "
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        ctx = await b.new_context()
        await ctx.add_cookies([{'name':'idev_session','value':'authenticated_CTO_2026','domain':'localhost','path':'/'},{'name':'idev_role','value':'CTO','domain':'localhost','path':'/'}])
        p = await ctx.new_page()
        await p.goto('http://localhost:3000', wait_until='networkidle')
        await p.screenshot(path='/tmp/idev-hr-branded.png', full_page=False)
        await b.close()
asyncio.run(main())
"
```

- [ ] **Step 3: Final commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-ui
git add README.md
git commit -m "docs: add README with quick start guide"
```
```bash
cd /Users/kuznetsov/Projects/iDev/idev-hr
git add -A
git commit -m "feat: complete iDev brand integration v1.0"
```
