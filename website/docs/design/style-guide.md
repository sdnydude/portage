---
title: DHG Design System v1
sidebar_position: 1
---

# DHG Design System v1

*Scope note: this guide is the DHG-wide design reference, canonically hosted in the Portage docs — other DHG projects link here rather than maintaining their own copies.*

The canonical color, typography, and component reference for all Digital Harmony Group products. Every design artifact — UI, SVG diagrams, documentation, marketing — references these tokens.

## Brand Principles

- **Warm-organic, not cold-tech.** Warm stone backgrounds, natural greens, and a handcrafted feel distinguish DHG from sterile SaaS aesthetics.
- **Premium, not flashy.** Apple-level restraint. Every element earns its place.
- **Complementary tension.** Orange (warm, action) paired with Deep Teal (cool, intelligence) creates visual energy without conflict.
- **No purple.** The AI industry has saturated purple. DHG uses Deep Teal for AI/intelligence signaling — distinctive and ownable.

---

## Color Palette

### Core Brand

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Graphite | `#2D2A26` | `45, 42, 38` | Primary text, ink, headings |
| Secondary Text | `#4A4742` | `74, 71, 66` | Labels, meta, helper copy |
| Orange | `#F77E2D` | `247, 126, 45` | Primary CTA buttons, key highlights |
| Blaze Orange | `#FF5500` | `255, 85, 0` | Strong accent, emphasis, urgency |
| Deep Teal | `#0D7377` | `13, 115, 119` | AI/assistive actions, intelligence indicators |
| Charcoal | `#3A3836` | `58, 56, 54` | Dark UI elements, footer, nav backgrounds |

<div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0'}}>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#2D2A26', borderRadius: '8px'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Graphite</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#2D2A26</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#4A4742', borderRadius: '8px'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Secondary</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#4A4742</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#F77E2D', borderRadius: '8px'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Orange</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#F77E2D</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#FF5500', borderRadius: '8px'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Blaze Orange</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#FF5500</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#0D7377', borderRadius: '8px'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Deep Teal</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#0D7377</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#3A3836', borderRadius: '8px'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Charcoal</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#3A3836</div>
  </div>
</div>

### Surfaces

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Warm Stone | `#F5F2EB` | `245, 242, 235` | App background |
| Off-White | `#F7F5F2` | `247, 245, 242` | Surface background, secondary panels |
| Card White | `#FFFFFF` | `255, 255, 255` | Cards, panels, elevated content |
| Shell | `#E8E5E0` | `232, 229, 224` | Chrome, tab bars, chips, pill labels |
| Taupe Border | `#D6D3CE` | `214, 211, 206` | Borders, dividers, input outlines |

<div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0'}}>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#F5F2EB', borderRadius: '8px', border: '1px solid #D6D3CE'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Warm Stone</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#F5F2EB</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#F7F5F2', borderRadius: '8px', border: '1px solid #D6D3CE'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Off-White</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#F7F5F2</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #D6D3CE'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Card White</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#FFFFFF</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#E8E5E0', borderRadius: '8px', border: '1px solid #D6D3CE'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Shell</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#E8E5E0</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#D6D3CE', borderRadius: '8px', border: '1px solid #B5B2AD'}}></div>
    <div style={{fontSize: '12px', marginTop: '6px', color: '#2D2A26', fontWeight: 600}}>Taupe Border</div>
    <div style={{fontSize: '11px', color: '#4A4742'}}>#D6D3CE</div>
  </div>
</div>

### Semantic States

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Success | `#0F9D58` | `15, 157, 88` | Completed actions, validated content |
| Warning | `#FFB800` | `255, 184, 0` | Warnings, pending states, caution |
| Error | `#D93025` | `217, 48, 37` | Errors, destructive actions, validation failures |
| Inverse | `#FFFFFF` | `255, 255, 255` | Text on dark backgrounds |

<div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0'}}>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#0F9D58', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 600}}>Success</div>
    <div style={{fontSize: '11px', marginTop: '6px', color: '#4A4742'}}>#0F9D58</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#FFB800', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2D2A26', fontSize: '13px', fontWeight: 600}}>Warning</div>
    <div style={{fontSize: '11px', marginTop: '6px', color: '#4A4742'}}>#FFB800</div>
  </div>
  <div style={{width: '120px', textAlign: 'center'}}>
    <div style={{width: '120px', height: '80px', backgroundColor: '#D93025', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 600}}>Error</div>
    <div style={{fontSize: '11px', marginTop: '6px', color: '#4A4742'}}>#D93025</div>
  </div>
</div>

### Portage Extended Palette

Portage adopted the DHG palette on 2026-06-09 (orange primary CTA, teal AI accent, graphite ink on warm stone). The original forest green ramp remains in `globals.css` as **legacy tokens** — kept until the per-screen migration off forest-green completes:

| Token | Hex | Usage |
|-------|-----|-------|
| Forest Green (legacy) | `#2D5A27` | Pre-2026-06-09 brand, migrating to DHG accents |
| Forest Green Light (legacy) | `#3D7A35` | Hover state |
| Forest Green Dark (legacy) | `#1E3D1A` | Pressed state |
| Forest Green 50 (legacy) | `#F0F7EF` | Tinted background |
| Forest Green 100 (legacy) | `#D4E8D1` | Light card fill |
| Accent Warm | `#D4A574` | Premium / leather accent |
| Accent Info | `#3B82F6` | Informational, links |

### Dark Mode

Dark theme is applied via a `.dark` class on `<html>` (theme-init script defaults to the OS preference, honoring a stored override):

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| Background | `#F5F2EB` | `#14130F` | Warm tones preserved |
| Surface | `#FFFFFF` | `#1A1713` | Warm dark |
| Surface Elevated | `#FFFFFF` | `#221E1A` | Subtle lift |
| Border | `#D6D3CE` | `#332F2A` | Matched warmth |
| Primary Text | `#2D2A26` | `#F0EDE8` | Warm white, not pure |
| Orange | `#F77E2D` | `#FF9A52` | Brighter for dark bg |
| Teal | `#0D7377` | `#19A5AB` | Brighter for dark bg |
| Forest Green (legacy) | `#2D5A27` | `#4CAF50` | Brighter for dark bg |

---

## Tailwind CSS Tokens

### CSS Custom Properties

In Portage's `apps/web/src/app/globals.css` the DHG accents are defined **unprefixed** (`--graphite`, `--teal`, `--orange`, …), each with `-bright` / `-dark` / `-soft` ramp variants:

```css
:root {
  /* Neutrals — DHG Warm Stone + Graphite */
  --background: #F5F2EB;
  --foreground: #2D2A26;
  --surface: #FFFFFF;
  --surface-elevated: #FFFFFF;
  --muted: #EFEBE1;
  --border: #D6D3CE;
  --border-focus: #2D5A27;

  --text-primary: #2D2A26;
  --text-secondary: #4A4742;
  --text-placeholder: #A3A3A3;
  --text-inverse: #FFFFFF;

  /* DHG accents */
  --warm-stone: #F5F2EB;
  --graphite: #2D2A26;
  --charcoal: #3A3836;
  --teal: #0D7377;          /* AI / intelligence accent */
  --teal-bright: #119AA0;
  --teal-dark: #0A4A47;
  --teal-soft: #E2F0F0;
  --orange: #F77E2D;        /* primary CTA */
  --orange-bright: #FF9A52;
  --orange-dark: #C9621B;
  --orange-soft: #FCEEE2;

  /* Legacy brand — kept until per-screen migration off forest-green */
  --forest-green: #2D5A27;
  --forest-green-light: #3D7A35;
  --forest-green-dark: #1E3D1A;
  --forest-green-50: #F0F7EF;
  --forest-green-100: #D4E8D1;

  --accent-warm: #D4A574;
  --accent-error: #DC3545;
  --accent-warning: #F59E0B;
  --accent-success: #0F9D58;
  --accent-info: #3B82F6;
}
```

### Tailwind `@theme` Block

```css
@theme inline {
  /* Primary CTA color */
  --color-primary: var(--orange);

  /* DHG accents → Tailwind utilities (bg-teal, text-orange, bg-graphite, …) */
  --color-warm-stone: var(--warm-stone);
  --color-graphite: var(--graphite);
  --color-charcoal: var(--charcoal);
  --color-teal: var(--teal);
  --color-teal-bright: var(--teal-bright);
  --color-teal-dark: var(--teal-dark);
  --color-teal-soft: var(--teal-soft);
  --color-orange: var(--orange);
  --color-orange-bright: var(--orange-bright);
  --color-orange-dark: var(--orange-dark);
  --color-orange-soft: var(--orange-soft);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-border-focus: var(--border-focus);

  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-placeholder: var(--text-placeholder);
  --color-text-inverse: var(--text-inverse);

  --color-forest-green: var(--forest-green);
  --color-forest-green-light: var(--forest-green-light);
  --color-forest-green-dark: var(--forest-green-dark);
  --color-forest-green-50: var(--forest-green-50);
  --color-forest-green-100: var(--forest-green-100);

  --color-accent-warm: var(--accent-warm);
  --color-accent-error: var(--accent-error);
  --color-accent-warning: var(--accent-warning);
  --color-accent-success: var(--accent-success);
  --color-accent-info: var(--accent-info);

  --font-sans: var(--font-plus-jakarta);
  --font-display: var(--font-instrument);
  --font-mono: var(--font-jetbrains);
}
```

### Usage in Components

```tsx
// DHG accent tokens (unprefixed in Portage)
<button className="bg-orange text-graphite">Primary CTA</button>
<span className="text-teal">AI-powered</span>
<div className="bg-warm-stone border-border">Panel</div>

// Semantic tokens
<div className="bg-surface border border-border">Card</div>
<p className="text-text-secondary">Helper text</p>
```

---

## Typography

### Font Stack

| Role | Font | CSS Variable | Fallback |
|------|------|-------------|----------|
| Display / Headlines | Instrument Sans | `--font-instrument` | `system-ui, sans-serif` |
| Body / UI | Plus Jakarta Sans | `--font-plus-jakarta` | `system-ui, sans-serif` |
| Code / Monospace | JetBrains Mono | `--font-jetbrains` | `monospace` |

### Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

### Type Scale

| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| Display | 32px / 2rem | 700 | Instrument Sans | Page titles, hero text |
| Title | 24px / 1.5rem | 600 | Instrument Sans | Section headings |
| Headline | 20px / 1.25rem | 600 | Instrument Sans | Card titles, sub-sections |
| Body | 16px / 1rem | 400 | Plus Jakarta Sans | Body text, descriptions |
| Caption | 14px / 0.875rem | 400 | Plus Jakarta Sans | Labels, meta, timestamps |

### Type Scale Examples

<div style={{padding: '24px', backgroundColor: '#F7F5F2', borderRadius: '12px', border: '1px solid #D6D3CE', margin: '16px 0'}}>
  <div style={{fontSize: '32px', fontWeight: 700, color: '#2D2A26', fontFamily: "'Instrument Sans', system-ui, sans-serif", marginBottom: '8px'}}>
    Display — 32px Bold
  </div>
  <div style={{fontSize: '24px', fontWeight: 600, color: '#2D2A26', fontFamily: "'Instrument Sans', system-ui, sans-serif", marginBottom: '8px'}}>
    Title — 24px Semibold
  </div>
  <div style={{fontSize: '20px', fontWeight: 600, color: '#2D2A26', fontFamily: "'Instrument Sans', system-ui, sans-serif", marginBottom: '8px'}}>
    Headline — 20px Semibold
  </div>
  <div style={{fontSize: '16px', fontWeight: 400, color: '#2D2A26', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginBottom: '8px'}}>
    Body — 16px Regular. The quick brown fox jumps over the lazy dog. Clean and readable at all sizes, Plus Jakarta Sans is the workhorse font for all body content.
  </div>
  <div style={{fontSize: '14px', fontWeight: 400, color: '#4A4742', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginBottom: '8px'}}>
    Caption — 14px Regular. Labels, metadata, timestamps, and helper text.
  </div>
  <div style={{fontSize: '13px', fontWeight: 400, color: '#4A4742', fontFamily: "'JetBrains Mono', monospace"}}>
    <code>Code — JetBrains Mono. const pipeline = analyzeImage(buffer);</code>
  </div>
</div>

### Text on Color Examples

<div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0'}}>
  <div style={{padding: '16px 20px', backgroundColor: '#2D2A26', borderRadius: '8px', color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '14px', minWidth: '200px'}}>
    <div style={{fontWeight: 600, marginBottom: '4px'}}>White on Graphite</div>
    <div style={{opacity: 0.7}}>14.3:1 — AAA</div>
  </div>
  <div style={{padding: '16px 20px', backgroundColor: '#0D7377', borderRadius: '8px', color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '14px', minWidth: '200px'}}>
    <div style={{fontWeight: 600, marginBottom: '4px'}}>White on Teal</div>
    <div style={{opacity: 0.7}}>5.6:1 — AA</div>
  </div>
  <div style={{padding: '16px 20px', backgroundColor: '#F77E2D', borderRadius: '8px', color: '#2D2A26', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '14px', minWidth: '200px'}}>
    <div style={{fontWeight: 600, marginBottom: '4px'}}>Graphite on Orange</div>
    <div style={{opacity: 0.7}}>5.4:1 — AA</div>
  </div>
  <div style={{padding: '16px 20px', backgroundColor: '#F5F2EB', borderRadius: '8px', color: '#2D2A26', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '14px', minWidth: '200px', border: '1px solid #D6D3CE'}}>
    <div style={{fontWeight: 600, marginBottom: '4px'}}>Graphite on Stone</div>
    <div style={{color: '#4A4742'}}>12.8:1 — AAA</div>
  </div>
</div>

### Usage in Components

```tsx
// Display heading
<h1 className="text-[2rem] font-bold font-[family-name:var(--font-instrument)]">
  Page Title
</h1>

// Body text
<p className="text-base text-text-primary">
  Body content in Plus Jakarta Sans.
</p>

// Code block
<code className="font-mono text-sm">
  const x = 42;
</code>
```

---

## Style Examples

### Buttons

<div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '16px 0', alignItems: 'center'}}>
  <div style={{padding: '12px 24px', backgroundColor: '#F77E2D', borderRadius: '12px', color: '#2D2A26', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'center'}}>
    Primary CTA
  </div>
  <div style={{padding: '12px 24px', backgroundColor: '#0D7377', borderRadius: '12px', color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'center'}}>
    AI Action
  </div>
  <div style={{padding: '12px 24px', backgroundColor: '#2D5A27', borderRadius: '12px', color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'center'}}>
    Portage Legacy Green
  </div>
  <div style={{padding: '12px 24px', backgroundColor: 'transparent', borderRadius: '12px', color: '#2D2A26', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', border: '1.5px solid #D6D3CE'}}>
    Secondary
  </div>
  <div style={{padding: '12px 24px', backgroundColor: '#D93025', borderRadius: '12px', color: '#FFFFFF', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'center'}}>
    Destructive
  </div>
</div>

### Cards

<div style={{display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '16px 0'}}>
  <div style={{width: '280px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #D6D3CE', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
    <div style={{height: '160px', backgroundColor: '#E8E5E0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4742', fontSize: '14px'}}>Photo Area</div>
    <div style={{padding: '16px'}}>
      <div style={{fontSize: '16px', fontWeight: 600, color: '#2D2A26', fontFamily: "'Instrument Sans', system-ui, sans-serif"}}>Item Title</div>
      <div style={{fontSize: '14px', color: '#4A4742', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginTop: '4px'}}>Electronics · Good condition</div>
      <div style={{fontSize: '16px', fontWeight: 600, color: '#2D5A27', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginTop: '8px'}}>$125 – $180</div>
    </div>
  </div>
  <div style={{width: '280px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #D6D3CE', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px'}}>
      <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0D7377'}}></div>
      <div style={{fontSize: '12px', color: '#0D7377', fontWeight: 600, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px'}}>AI Identified</div>
    </div>
    <div style={{fontSize: '18px', fontWeight: 600, color: '#2D2A26', fontFamily: "'Instrument Sans', system-ui, sans-serif"}}>Fender Stratocaster</div>
    <div style={{fontSize: '14px', color: '#4A4742', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginTop: '6px', lineHeight: '1.5'}}>American Standard, sunburst finish, rosewood fretboard. Minor fret wear on first 5 frets.</div>
    <div style={{display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap'}}>
      <span style={{padding: '4px 10px', backgroundColor: '#E8E5E0', borderRadius: '20px', fontSize: '12px', color: '#4A4742'}}>music</span>
      <span style={{padding: '4px 10px', backgroundColor: '#E8E5E0', borderRadius: '20px', fontSize: '12px', color: '#4A4742'}}>guitar</span>
      <span style={{padding: '4px 10px', backgroundColor: '#E8E5E0', borderRadius: '20px', fontSize: '12px', color: '#4A4742'}}>electric</span>
    </div>
  </div>
</div>

### Status Indicators

<div style={{display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '16px 0'}}>
  <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: 'rgba(15, 157, 88, 0.1)', borderRadius: '8px', border: '1px solid rgba(15, 157, 88, 0.2)'}}>
    <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0F9D58'}}></div>
    <span style={{fontSize: '13px', color: '#0F9D58', fontWeight: 500}}>Published</span>
  </div>
  <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: 'rgba(255, 184, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 184, 0, 0.2)'}}>
    <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FFB800'}}></div>
    <span style={{fontSize: '13px', color: '#B8860B', fontWeight: 500}}>Pending</span>
  </div>
  <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: 'rgba(217, 48, 37, 0.1)', borderRadius: '8px', border: '1px solid rgba(217, 48, 37, 0.2)'}}>
    <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D93025'}}></div>
    <span style={{fontSize: '13px', color: '#D93025', fontWeight: 500}}>Failed</span>
  </div>
  <div style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: 'rgba(13, 115, 119, 0.1)', borderRadius: '8px', border: '1px solid rgba(13, 115, 119, 0.2)'}}>
    <div style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0D7377'}}></div>
    <span style={{fontSize: '13px', color: '#0D7377', fontWeight: 500}}>AI Processing</span>
  </div>
</div>

### Chips & Tags

<div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '16px 0'}}>
  <span style={{padding: '6px 14px', backgroundColor: '#E8E5E0', borderRadius: '20px', fontSize: '13px', color: '#2D2A26', fontWeight: 500}}>Electronics</span>
  <span style={{padding: '6px 14px', backgroundColor: '#F0F7EF', borderRadius: '20px', fontSize: '13px', color: '#2D5A27', fontWeight: 500, border: '1px solid #D4E8D1'}}>Good</span>
  <span style={{padding: '6px 14px', backgroundColor: 'rgba(13, 115, 119, 0.1)', borderRadius: '20px', fontSize: '13px', color: '#0D7377', fontWeight: 500}}>AI Scanned</span>
  <span style={{padding: '6px 14px', backgroundColor: 'rgba(247, 126, 45, 0.1)', borderRadius: '20px', fontSize: '13px', color: '#F77E2D', fontWeight: 500}}>Hot Item</span>
</div>

---

## Shadows & Elevation

Four depth levels, warm-tinted (black opacity, not blue):

| Level | Value | Usage |
|-------|-------|-------|
| Subtle | `0 1px 2px rgba(0, 0, 0, 0.05)` | Default resting state |
| Medium | `0 4px 12px rgba(0, 0, 0, 0.08)` | Hovered cards, dropdowns |
| Elevated | `0 8px 24px rgba(0, 0, 0, 0.12)` | Modals, floating panels |
| Floating | `0 16px 48px rgba(0, 0, 0, 0.16)` | Full-screen overlays |

```css
:root {
  --shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-medium: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-floating: 0 16px 48px rgba(0, 0, 0, 0.16);
}
```

<div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '16px 0', padding: '24px', backgroundColor: '#F5F2EB', borderRadius: '12px'}}>
  <div style={{width: '120px', height: '80px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#4A4742'}}>Subtle</div>
  <div style={{width: '120px', height: '80px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#4A4742'}}>Medium</div>
  <div style={{width: '120px', height: '80px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#4A4742'}}>Elevated</div>
  <div style={{width: '120px', height: '80px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#4A4742'}}>Floating</div>
</div>

---

## Glass Morphism

Apple-inspired frosted glass materials with three tiers:

| Tier | Blur | Background | Border | Class |
|------|------|-----------|--------|-------|
| Thick | 30px | `rgba(255, 255, 255, 0.72)` | `rgba(255, 255, 255, 0.3)` | `.glass-thick` |
| Regular | 20px | `rgba(255, 255, 255, 0.60)` | `rgba(255, 255, 255, 0.2)` | `.glass-regular` |
| Thin | 10px | `rgba(255, 255, 255, 0.40)` | `rgba(255, 255, 255, 0.15)` | `.glass-thin` |

All tiers apply `saturate(180%)` for vibrancy. A `@supports` fallback provides a solid `var(--surface)` background for browsers without `backdrop-filter`.

```tsx
<nav className="glass-regular glass-fallback border-t">
  Tab bar content
</nav>
```

---

## Animation

### Named Animations

| Name | Timing | Usage |
|------|--------|-------|
| `slide-up` | `0.3s ease-out` | Bottom sheets, modals |
| `spring-in` | `0.4s cubic-bezier(0.34, 1.56, 0.64, 1)` | Cards entering view |
| `shimmer` | `1.5s ease-in-out infinite` | Loading skeletons |
| `fade-in` | `0.3s ease-out` | Subtle content reveal |
| `pulse-glow` | `2s ease-in-out infinite` | Active/scanning state |
| `check-draw` | `0.6s ease-out 0.3s` | Success checkmark |
| `confetti-fall` | varies | Publish celebration |

### Utility Classes

```tsx
<div className="animate-spring-in">Card popping in</div>
<div className="animate-shimmer">Loading skeleton</div>
<div className="animate-fade-in">Fading in</div>
```

### Accessibility

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-spring-in,
  .animate-shimmer,
  .animate-fade-in,
  .animate-slide-up,
  .animate-pulse-glow {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
}
```

---

## Spacing & Layout

### Safe Areas

Mobile PWA with notch/home-indicator support:

```css
:root {
  --tab-bar-height: 5rem;
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}
```

### Content Width

All main content constrained to `max-w-lg` (32rem / 512px) centered with `mx-auto`. This creates a mobile-native feel on all screen sizes.

### Z-Index Scale

| Layer | Z-Index | Element |
|-------|---------|---------|
| Content | `auto` | Normal page content |
| Sticky headers | `z-40` | PageHeader |
| Tab bar | `z-50` | Bottom navigation (includes the center Scan button) |
| Overlays | `z-[60]` | ScanFlow, modals |

---

## Component Library

### Layout

#### PageHeader

Sticky top navigation bar with title, optional subtitle, and action slot.

```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}
```

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Page title, rendered in Instrument Sans |
| `subtitle` | `string?` | Secondary text below title |
| `action` | `ReactNode?` | Right-aligned action (button, icon, menu) |

Styling: `sticky top-0`, `bg-background/95` with `backdrop-blur-md`, bottom border. Content centered at `max-w-lg`.

```tsx
<PageHeader
  title="Inventory"
  subtitle="24 items"
  action={<button>+ Add</button>}
/>
```

#### TabBar

Bottom navigation with 5 tabs (Home, Inventory, Listings, Porter, Orders) split around a center Scan button. Uses glass morphism with safe area padding. More is not a tab — Settings (`/more`) is reached via the PageHeader avatar on mobile and the sidebar secondary section on `lg+`.

| Tab | Position |
|-----|----------|
| Home | Left |
| Inventory | Left |
| Listings | Left |
| Porter | Right (tinted `--teal` as the AI accent) |
| Orders | Right |

Active tab: `text-[var(--text-primary)]` with a dot indicator. Inactive: `text-text-secondary`.

---

### Capture

#### Scan button

The center TabBar button opens the full-screen ScanFlow. `w-14 h-14` circle, `bg-[var(--orange)]`, elevated shadow with a background ring, `-mt-7` float above the bar. Press: `active:scale-95`.

#### ScanFlow

Full-screen overlay (`z-[60]`) for photo capture and AI scanning. Orchestrates: CameraCapture, ImagePicker, recognition results, and the listing flow fork.

| Prop | Type | Description |
|------|------|-------------|
| `onClose` | `() => void` | Dismiss the overlay |

---

### Inventory

#### ItemCard

Dual-layout item display supporting grid and list views.

```tsx
interface ItemCardProps {
  item: Item;
  view: "grid" | "list";
}
```

**Grid mode:** Square aspect ratio photo, title below, category/condition chips. Full card is a link to detail.

**List mode:** 64px thumbnail, title + meta inline, value right-aligned in `text-forest-green`.

Both modes: `bg-surface`, `rounded-xl`, `border border-border`, hover transitions to `border-focus`.

#### SearchBar

Text input with search icon prefix. Placeholder: contextual to current view.

#### ViewControls

Toggle between grid (`2-col`) and list view. Active state: `bg-forest-green text-white`.

#### BulkActionBar

Sticky bottom bar for multi-select operations. Actions: Delete, Archive, Activate, Export.

---

### Listing Flow

Three UX modes sharing one state hook (`useListingFlow`):

#### HybridFlow (default)

Chat-guided listing with inline cards and photo hero. Combines Porter AI suggestions with direct editing.

#### ConversationalFlow

Step-by-step Q&A guided by Porter AI. Minimal UI — one question at a time.

#### SwipeFlow

Card-stack interface for rapid listing creation. Swipe-based decision making.

#### Common Sub-Components

| Component | Purpose |
|-----------|---------|
| `PhotoCaptureFlow` | Multi-photo capture with inline editing and reordering |
| `PhotoEditOverlay` / `PhotoEditPanel` (in `capture/`) | Rotate, crop, exposure, enhance, BG removal overlay |
| `RecognitionFork` | "List for Sale" vs "Save to Inventory" decision point |
| `CompsPricingWidget` | Comparable sales display with price adjustment slider |
| `PricingStrategyPicker` | Fast / Market / Max pricing presets |
| `ShippingConfigCard` | Package size, weight, method selector |
| `FeeEstimate` | Marketplace fee breakdown |
| `PublishSuccess` | Confetti celebration + next-action links |
| `ListingPreviewCard` | Full listing preview with inline editing |

#### RecognitionFork

Decision gate after AI scan. Auto-bypasses after 5 uses based on user preference.

```tsx
interface RecognitionForkProps {
  onListForSale: () => void;
  onSaveToInventory: () => void;
}
```

#### ListingPreviewCard

Editable preview of listing before publish. Supports inline text editing (tap to edit), photo carousel, marketplace-specific fields, and publish button.

```tsx
interface ListingPreviewCardProps {
  data: PreparedListingData;
  photos: Array<{ url: string; key: string }>;
  quantity: number;
  onFieldChange: (field: string, value: unknown) => void;
  onPriceChange: (price: number) => void;
  onQuantityChange: (quantity: number) => void;
  onPublish: (marketplace: "ebay" | "reverb", publishMode: "draft" | "live", aspects?: Record<string, string[]>) => void;
  isPublishing: boolean;
  sellerProfileComplete: boolean;
  onPhotoUpdated?: (index: number, patch: { url: string; key?: string; width?: number; height?: number }) => void;
}
```

#### CompsPricingWidget

Interactive pricing panel showing comparable sold items from eBay and Reverb with confidence indicators.

```tsx
interface CompsPricingWidgetProps {
  pricing: PricingData;
  comps: { ebay: CompResult | null; reverb: ReverbCompResult | null };
  currentPrice: number;
  onPriceChange: (price: number) => void;
}
```

Confidence colors: High = `var(--teal)`, Medium = `#B8860B`, Low = `#CC3333`.

#### PublishSuccess

Post-publish celebration with checkmark animation, listing summary, and navigation options.

```tsx
interface PublishSuccessProps {
  listingId: string;
  marketplace: 'ebay' | 'reverb';
  title: string;
  price: number;
  photoUrl: string | null;
  isFirstListing: boolean;
  onListAnother: () => void;
  // Marketplace publish fell back to draft — carries the marketplace's reason
  warning?: string;
}
```

---

### Image

#### BeforeAfterSlider

Horizontal drag slider comparing original and processed images (used for background removal preview).

#### Background removal (server-side)

Background removal runs server-side, not in the browser: the `useBgRemoval` hook (`src/hooks/use-bg-removal.ts`) records a billing-gated usage event (`POST /usage/bg-removal`), then calls `POST /images/remove-bg`, which the API fulfills via the portage-rembg container and returns the processed image URL/key. Results are previewed with BeforeAfterSlider.

---

### Onboarding

#### OnboardingFlow

5-step first-time user carousel with slide transitions. Each step: icon, title, subtitle, body text.

```tsx
interface OnboardingFlowProps {
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  isCompleting: boolean;
}
```

Steps: Welcome, AI Scanning, Marketplace Integration, Pricing Intelligence, Get Started.

---

### Celebration

#### SoldCelebration

Full-screen confetti animation triggered when an item sells. Uses CSS `confetti-fall` keyframes.

---

## SVG Production Guide

For hand-crafted architecture diagrams, flow charts, and documentation visuals.

### Color Assignments

| Diagram Element | Color | Hex |
|----------------|-------|-----|
| Node fill (primary) | Off-White | `#F7F5F2` |
| Node fill (active/AI) | Deep Teal tint | `#0D7377` at 15% opacity |
| Node fill (action) | Orange tint | `#F77E2D` at 15% opacity |
| Node stroke | Taupe Border | `#D6D3CE` |
| Arrow / connector | Secondary Text | `#4A4742` |
| Label text | Graphite | `#2D2A26` |
| Background | Warm Stone | `#F5F2EB` |
| Accent highlight | Orange | `#F77E2D` |
| AI/intelligence callout | Deep Teal | `#0D7377` |
| Error path | Error Red | `#D93025` |
| Success path | Success Green | `#0F9D58` |

### Font Embedding

SVG `<text>` elements must specify the font stack explicitly for portability:

```xml
<text font-family="'Plus Jakarta Sans', 'Instrument Sans', system-ui, sans-serif"
      font-size="14" fill="#2D2A26">
  Label text
</text>

<text font-family="'Instrument Sans', system-ui, sans-serif"
      font-size="20" font-weight="600" fill="#2D2A26">
  Heading text
</text>

<text font-family="'JetBrains Mono', monospace"
      font-size="12" fill="#4A4742">
  code_reference()
</text>
```

### Minimum Contrast

All text must meet WCAG AA (4.5:1 for body, 3:1 for large text). Key ratios:

| Text Color | Background | Ratio | Pass |
|-----------|-----------|-------|------|
| `#2D2A26` on `#F5F2EB` | Graphite on Stone | 12.8:1 | AAA |
| `#2D2A26` on `#FFFFFF` | Graphite on White | 14.3:1 | AAA |
| `#4A4742` on `#F5F2EB` | Secondary on Stone | 8.3:1 | AAA |
| `#FFFFFF` on `#0D7377` | White on Teal | 5.6:1 | AA |
| `#2D2A26` on `#F77E2D` | Graphite on Orange | 5.4:1 | AA |
| `#FFFFFF` on `#2D2A26` | White on Graphite | 14.3:1 | AAA |

**Warning:** White text on Orange (`#F77E2D`) fails WCAG at 2.6:1. Always use Graphite (`#2D2A26`) text on orange backgrounds.
