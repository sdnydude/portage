---
id: design-system
title: Design System
sidebar_position: 2
---

# Design System

Portage uses a custom design system built on **Tailwind v4** with CSS custom properties. The aesthetic is Apple-inspired minimalism with a forest green brand identity and glass morphism effects.

## Brand Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--forest-green` | `#2D5A27` | `#4CAF50` | Primary actions, active states |
| `--accent-warm` | `#D4A574` | `#D4A574` | Warm accent (tan) |
| `--accent-error` | `#DC3545` | — | Error states |
| `--accent-warning` | `#F59E0B` | — | Warning states |
| `--accent-success` | `#2D5A27` | — | Success states |
| `--accent-info` | `#3B82F6` | — | Info states |

## Surfaces

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#F8F7F4` | `#0F1210` |
| `--surface` | `#FFFFFF` | `#1A1F1A` |
| `--surface-elevated` | `#FFFFFF` | `#242B24` |
| `--muted` | `#F5F3EF` | `#1A1F1A` |

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
  --color-forest-green: var(--forest-green);
  --color-surface: var(--surface);
  --color-border-focus: var(--border-focus);
  /* ... all tokens mapped */
}
```

This allows usage like `text-forest-green`, `bg-surface`, `border-border-focus` directly in class names.

## Dark Mode

Dark mode is the default (`defaultMode: 'dark'` in Docusaurus config). The app respects `prefers-color-scheme` and all tokens have light/dark variants via `[data-theme='dark']` selectors.

## iOS Considerations

- All form inputs use `text-base` (16px) minimum to prevent iOS auto-zoom on focus
- `pt-safe` class adds `padding-top: env(safe-area-inset-top)` for notched devices
- `.select-all` class on tracking numbers enables tap-to-select behavior
