# terminal.dev — Design System v1.0

A monospace, terminal-flavored design system for engineering portfolios.
Designed for **ekuznetsov.dev** — Evgenii Kuznetsov, AI engineer (Paris ↔ Tokyo).

## Files

```
design-system/
├── tokens.css        Design tokens (colors, type, spacing, motion)
├── components.css    Component classes (.eds-*)
├── index.html        Living documentation page
└── README.md         This file
```

## Install

No build step. Two ways:

**1. Drop-in CSS**

```html
<link rel="stylesheet" href="design-system/components.css">
<body data-palette="orange-warm">
  <a class="eds-btn eds-btn--primary">./contact.sh →</a>
</body>
```

**2. Tokens only** (for your own components)

```html
<link rel="stylesheet" href="design-system/tokens.css">
<style>
  .my-thing { background: var(--color-accent); padding: var(--s-4); }
</style>
```

## Palettes

Set `data-palette` on `<body>` (or any ancestor):

| value          | mood                              |
|----------------|-----------------------------------|
| `orange-warm`  | default · cyber-Tokyo, warm CRT   |
| `blue-cool`    | classic terminal, info-dense      |
| `violet-dawn`  | premium, Paris-by-night           |
| `matcha`       | calm, eco-leaning                 |

## Components

| class                | what                          |
|----------------------|-------------------------------|
| `.eds-display`       | huge mono headline (96–112px) |
| `.eds-h1` … `.eds-h3`| heading scale                 |
| `.eds-body`          | body text (14px / 1.55)       |
| `.eds-mono-label`    | small caps mono label         |
| `.eds-btn`           | + `--primary` `--ghost` `--link` |
| `.eds-tag`           | + `--blue` `--green` `--violet`  |
| `.eds-panel`         | bordered translucent panel    |
| `.eds-stat`          | metric card                   |
| `.eds-kv`            | key/value row                 |
| `.eds-input`         | underline input               |
| `.eds-sechead`       | section heading w/ number     |
| `.eds-bg-grid`       | dotted grid background        |
| `.eds-bg-glow`       | radial color glow             |
| `.eds-scanlines`     | CRT scanline overlay          |

## Token reference

See `tokens.css`. Highlights:

- **Colors**: `--color-bg`, `--color-text`, `--color-accent`, `--color-blue/green/violet`
- **Type**: `--font-mono`, `--fs-10` … `--fs-112`
- **Spacing**: `--s-1` (4px) … `--s-24` (96px), 4-pt grid
- **Radii**: `--r-none` `--r-xs` `--r-sm` `--r-md` (intentionally low — terminals don't round)
- **Motion**: `--ease-out`, `--dur-fast/base/slow`

## Typography

- **Mono**: JetBrains Mono (preferred), IBM Plex Mono, Fira Code, Geist Mono — all 400/500/600
- **Sans**: Inter (UI fallback)

Load via Google Fonts (already in `components.css`) or self-host.

## Principles

1. **Calm by default** — defaults are the deepest interface
2. **Material honesty** — tokens, latency and cost are physical
3. **Slow > fast** — built to run for a decade, not a launch weekend
4. **Mono first** — code is the medium; type matches the medium
5. **Low radii, no faux skeuomorphism** — rectangles are honest

## License

MIT — use freely, attribution appreciated.

---
**v1.0** · 2026·04·25 · ekuznetsov.dev
