---
id: design-system
title: Design System
sidebar_position: 2
---

# Design System

Portage uses a custom design system built on **Tailwind v4** with CSS custom properties. Since 2026-06-09 the app follows the **DHG design system** — graphite ink and warm-stone surfaces with orange (primary CTA) and deep teal (AI/intelligence) accents — with Apple-inspired minimalism and glass morphism effects. The original forest-green palette survives only as legacy tokens pending per-screen migration.

## Brand Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--orange` | `#F77E2D` | `#FF9A52` | Primary CTA (also `--color-primary`) |
| `--teal` | `#0D7377` | `#19A5AB` | AI / intelligence accent (Porter) |
| `--graphite` | `#2D2A26` | — | Primary ink |
| `--warm-stone` | `#F5F2EB` | `#1B1814` | Warm surface tone |
| `--forest-green` | `#2D5A27` | `#4CAF50` | Legacy brand — kept until per-screen migration off forest-green |
| `--accent-warm` | `#D4A574` | `#D4A574` | Warm accent (tan) |
| `--accent-error` | `#DC3545` | `#F87171` | Error states |
| `--accent-warning` | `#F59E0B` | — | Warning states |
| `--accent-success` | `#0F9D58` | `#2EC27E` | Success states |
| `--accent-info` | `#3B82F6` | — | Info states |

The orange and teal scales each have `-bright`, `-dark`, and `-soft` variants (e.g. `--orange-soft`, `--teal-dark`).

## Surfaces

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#F5F2EB` | `#14130F` |
| `--surface` | `#FFFFFF` | `#1A1713` |
| `--surface-elevated` | `#FFFFFF` | `#221E1A` |
| `--muted` | `#EFEBE1` | `#1B1814` |

## Typography

| Token | Size | Usage |
|-------|------|-------|
| `--text-display` | 32px | Portfolio value hero |
| `--text-title` | 24px | Page titles |
| `--text-headline` | 20px | Section headers |
| `--text-body` | 16px | Body text |
| `--text-caption` | 14px | Labels, timestamps |

### Fonts

| Family | Variable | Usage |
|--------|----------|-------|
| Instrument Sans | `--font-instrument` | Display headings |
| Plus Jakarta Sans | `--font-plus-jakarta` | Body text |
| JetBrains Mono | `--font-jetbrains` | Code, tracking numbers |

## Glass Morphism

Three glass morphism utility classes using `backdrop-filter: blur() saturate(180%)`:

| Class | Blur | Use Case |
|-------|------|----------|
| `.glass-thick` | 30px | Tab bar, modals |
| `.glass-regular` | 20px | Navigation |
| `.glass-thin` | 10px | Cards, overlays |

A `.glass-fallback` class provides solid backgrounds for browsers without `backdrop-filter` support.

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-subtle` | `0 1px 2px rgba(0,0,0,0.05)` | Cards, list items |
| `--shadow-medium` | `0 4px 12px rgba(0,0,0,0.08)` | Floating cards |
| `--shadow-elevated` | `0 8px 24px rgba(0,0,0,0.12)` | FAB, modals |
| `--shadow-floating` | `0 16px 48px rgba(0,0,0,0.16)` | Full-screen overlays |

## Animations

| Class | Effect | Duration |
|-------|--------|----------|
| `.animate-slide-up` | Slide from bottom | 300ms |
| `.animate-slide-up-full` | Full-screen slide + fade | 350ms |
| `.animate-spring-in` | Scale bounce (0.85→1.05→1) | 400ms |
| `.animate-shimmer` | Loading skeleton shimmer | 1.5s infinite |
| `.animate-fade-in` | Opacity fade | 300ms |
| `.animate-pulse-glow` | Forest-green box-shadow pulse | 2s infinite |
| `.animate-check-draw` | SVG checkmark stroke | 600ms |

All animations respect `prefers-reduced-motion` — they're globally disabled for users who prefer reduced motion.

## Tailwind Integration

Tailwind v4 is configured entirely in CSS (no `tailwind.config.js`):

```css
@import "tailwindcss";

@theme inline {
  --color-primary: var(--orange);
  --color-teal: var(--teal);
  --color-orange: var(--orange);
  --color-graphite: var(--graphite);
  --color-surface: var(--surface);
  --color-border-focus: var(--border-focus);
  /* ... all tokens mapped */
}
```

This allows usage like `bg-orange`, `text-teal`, `bg-surface`, `border-border-focus` directly in class names (legacy `text-forest-green` utilities remain mapped during the migration).

## Dark Mode

Dark mode is applied via a `.dark` class on `<html>`: a theme-init script in the root layout defaults it to the OS `prefers-color-scheme` preference and honors a stored user override (the ThemeToggle component). All tokens have light/dark variants under the `:root.dark` selector in `globals.css`.

## iOS Considerations

- All form inputs use `text-base` (16px) minimum to prevent iOS auto-zoom on focus
- `pt-safe` class adds `padding-top: env(safe-area-inset-top)` for notched devices
- `.select-all` class on tracking numbers enables tap-to-select behavior
