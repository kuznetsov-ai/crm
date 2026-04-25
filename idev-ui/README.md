# iDev UI Kit

Shared design system for all iDev projects, extracted from [i-develop.tech](https://i-develop.tech).

## Quick Start

### Next.js + Tailwind (idev-hr, idev-hr-demo)
In `globals.css`:
```css
@import "../../../idev-ui/tokens/tokens.css";
```
In `@theme inline`, map CSS vars to Tailwind color names.

### Vanilla HTML (idev-website)
```html
<link rel="stylesheet" href="../idev-ui/tokens/tokens.css">
```

### Django (ESS)
Copy `tokens/tokens.css` to `static/css/` or add path to `STATICFILES_DIRS`.

## Brandbook
Open `docs/brandbook.html` in any browser — full visual reference.

## Tokens
See `tokens/tokens.css` — all CSS custom properties for colors, typography, spacing, and theme switching.

## Components
`Button` · `Badge` · `StatCard` · `DataTable` · `Input` · `ThemeToggle`

## Theme Switching
Set `data-theme="dark"` or `data-theme="light"` on `<html>`. Use `ThemeToggle` component or set manually.
Preference persists in `localStorage('idev-theme')`.

## Projects
- **idev-hr** — Next.js 16 HR system (primary consumer)
- **idev-hr-demo** — demo version
- **idev-website** — company site (vanilla HTML)
- **ESS** — Employee Share Scheme (Django)
