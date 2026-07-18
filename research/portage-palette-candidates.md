# Portage Palette Candidates — Three Anti-Cliché Systems

**Date:** 2026-07-11. Companion to `research/ai-design-cliches.md` (the exclusion table — rows referenced below by number).

**Exclusion space cleared:** DHG warm-stone system (orange-tinted `#F5F2EB` neutrals, orange `#F77E2D`/`#FF5500`, deep teal `#0D7377`), the Lagoon system (deep teal-green `#10403D`, sea-tinted neutrals), all 60 rows of the clichés table, and purple/violet in any role. *Caveat:* tonight's 15 background proposals exist only in the session, not in the repo — they could not be diffed hex-by-hex, so exclusion was done by hue-space (nothing below sits in cream/stone, teal/sea-green, or purple/indigo territory). Stephen should sanity-check the three grounds against that list.

**Directions considered and rejected before settling on three:** sage + cream (Canva-template pairing, adjacent to row 6), terracotta anything (row 6), charcoal + neon accent (rows 4, 14), pure-achromatic gallery gray (rows 9–10, and it *is* sterile SaaS), copper/rust (reads as the excluded orange family), forest/kelly green (Portage's own legacy brand — already presented by definition), navy + gold "trust" banking palette in its saturated form (too close to row 2/3 SaaS blue until desaturated to denim, which is what Selvedge does deliberately), aubergine (purple ban).

All contrast ratios below were **computed** (WCAG 2.1 relative luminance), not estimated. Body-text pairs target AA 4.5:1.

---

## 1 · Ledger

**Concept:** the leather-bound sales ledger — oxblood hide, iron-gall ink, a brass hallmark. Provenance and record-keeping made tactile: every item in Portage is an entry in someone's ledger.

### Tokens — light

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#F7F4F3` | App background — rose-cast plaster (R≈B, no yellow cast: not cream) |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--surface-elevated` | `#FFFFFF` | Modals, sheets (differentiated by shadow) |
| `--muted` | `#EDE7E6` | Shell, chips, pill labels, skeletons |
| `--border` | `#DAD2D1` | Hairlines, input outlines |
| `--border-strong` | `#B9AFAE` | Emphasized dividers, hover borders |
| `--text-primary` | `#292325` | Ink — rose-black |
| `--text-secondary` | `#564E51` | Labels, meta |
| `--text-placeholder` | `#8E8489` | Placeholders (decorative, WCAG-exempt) |
| `--text-inverse` | `#FFFFFF` | Text on action/AI/dark |
| `--action` | `#8A2E3C` | Oxblood — primary CTA, links |
| `--action-bright` | `#A64453` | Hover |
| `--action-dark` | `#6B1F2C` | Pressed |
| `--action-soft` | `#F6E6E9` | Selected states, action wash |
| `--ai` | `#33566E` | Iron-gall ink blue — Porter / assistive |
| `--ai-soft` | `#E6EDF3` | AI chips, Porter message bg |
| `--tertiary` | `#7E6118` | Brass — badges, "hallmark" accents, price highlights |
| `--tertiary-soft` | `#F4EDDA` | Brass wash |
| `--focus-ring` | `#33566E` | Focus outline (distinct from error red) |
| `--success` / wash | `#21754A` / `#E3F1E9` | |
| `--warning` / wash | `#8A5A00` / `#F6EEDC` | |
| `--error` / wash | `#B3271E` / `#F9E7E5` | |

### Tokens — dark

| Token | Hex |
|---|---|
| `--ground` | `#1B1618` |
| `--surface` | `#241E20` |
| `--surface-elevated` | `#2C2528` |
| `--border` | `#40383B` |
| `--text-primary` | `#F1ECED` |
| `--text-secondary` | `#C0B7BA` |
| `--text-placeholder` | `#918A8D` |
| `--action` (accent/text use) | `#E08B97` |
| `--action` (button fill) | `#A64453` (white text, 4.7:1) |
| `--ai` | `#8FB6D2` |
| `--tertiary` | `#D6B356` |
| `--success` / `--warning` / `--error` | `#6FBF8F` / `#E0A63F` / `#E8887F` |
| washes (dark) | 16% opacity of accent over surface |

### Forms proof (computed ratios)

- Input `#FFFFFF` on page `#F7F4F3`: 1.09:1 tint separation **plus** `--border #DAD2D1` outline (1.49:1 vs surface) — inputs read as wells at 375px without heavy chrome.
- Focus ring `#33566E`: 7.79:1 against white input bg — unmissable, and hue-distinct from the error state.
- Error text `#B3271E` on ground 5.95:1, on white 6.51:1, on its wash 5.45:1 — legible at 12px caption size. Success `#21754A` on wash 4.86:1.
- Body text: `#292325` on ground **14.10:1**, on surface **15.43:1**, on muted **12.61:1**. Secondary `#564E51` on ground 7.37:1. Every background token carries AA+ body text.
- Buttons: white on oxblood **8.28:1** (AAA); pressed `#6B1F2C` 11.31:1. Oxblood as link text on ground 7.56:1.
- Dark forms: text on surface 14.01:1; error `#E8887F` 6.44:1; all accents ≥6.4:1 as text on dark surface.

### Image proof

Ground chroma is ~1% (R247 G244 B243) — below the threshold where a background shifts perceived photo color, so product photos keep their own color story. Test cases: **warm wood item** — the faint rose undertone is temperature-adjacent to wood tones, so a walnut guitar or leather bag sits harmoniously rather than clashing (unlike a cool gray that makes wood look orange). **Black electronics** — ~14:1 luminance separation from ground; the object pops with no halo tricks. **White-background stock photo** — 1.09:1 tint difference makes the white rectangle visible as an object on the page, and the standard card hairline (`--border`) closes the gap; no "floating white hole" effect. Dark mode ground `#1B1618` is warm-black, so photos read like prints on a dark mat rather than screens in a void.

### Anti-AI audit

No purple/indigo in any token (rows 1–5, 13); ground is rose-plaster with R≈B — explicitly **not** the cream/beige "tasteful AI surface" and the accent is oxblood, not terracotta (row 6); neutrals are brand-tinted, not shadcn zinc or pure #FFF/#000 (rows 9–10); one dominant action color with clear subordinates, not a timid balanced spread (row 11); light-first with a true dark ramp (row 14); oxblood + iron-gall + brass appears nowhere in the clichés corpus.

---

## 2 · Selvedge

**Concept:** vintage denim, the selvedge edge, gold thread. Resale-native: the most-traded second-hand object on earth is a pair of jeans. Indigo-*dye* depth (desaturated Prussian), never indigo-*500*.

### Tokens — light

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#F5F6F8` | Chambray white (faint cool cast, ~1% chroma) |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--surface-elevated` | `#FFFFFF` | Modals, sheets |
| `--muted` | `#E9EBEF` | Shell, chips, skeletons |
| `--border` | `#D3D7DE` | Hairlines |
| `--border-strong` | `#AEB4BF` | Emphasized dividers |
| `--text-primary` | `#21262E` | Denim-black ink |
| `--text-secondary` | `#4C545F` | Labels, meta |
| `--text-placeholder` | `#848D99` | Placeholders |
| `--text-inverse` | `#FFFFFF` | |
| `--action` | `#35577C` | Worn denim — primary CTA, links |
| `--action-bright` | `#4C6F96` | Hover |
| `--action-dark` | `#263F5C` | Pressed |
| `--action-soft` | `#E8EDF4` | Selected/wash |
| `--ai` | `#8A6712` | Gold thread — Porter / assistive (the warm human stitch in the cool cloth) |
| `--ai-soft` | `#F6EFD9` | AI wash |
| `--tertiary` | `#3E6B50` | Juniper — condition chips, provenance tags |
| `--tertiary-soft` | `#E5F0E9` | |
| `--focus-ring` | `#35577C` | |
| `--success` / wash | `#257A46` / `#E2F1E8` | |
| `--warning` / wash | `#925C00` / `#F7EEDC` | |
| `--error` / wash | `#B42B23` / `#F9E7E6` | |

### Tokens — dark

| Token | Hex |
|---|---|
| `--ground` | `#14171C` |
| `--surface` | `#1B1F26` |
| `--surface-elevated` | `#232830` |
| `--border` | `#39404B` |
| `--text-primary` | `#EDEFF3` |
| `--text-secondary` | `#B9BFC9` |
| `--text-placeholder` | `#8A919C` |
| `--action` (accent/text) | `#8FB0D4`; button fill `#4C6F96` w/ white text |
| `--ai` | `#D5AF4B` |
| `--tertiary` | `#82B296` |
| `--success` / `--warning` / `--error` | `#66BE8B` / `#E2A83E` / `#E98B82` |

### Forms proof (computed)

- Body text `#21262E`: ground **14.06:1**, surface **15.20:1**, muted **12.74:1**. Secondary 7.09:1 on ground.
- White on denim action **7.48:1**; pressed 10.78:1; denim link text on ground 6.92:1. Focus ring = action, 7.48:1 vs white input.
- Gold-thread AI as text on white 5.21:1 and on its own wash 4.53:1 — the tightest pair in all three palettes, still AA; Porter labels stay legible at caption size.
- Error 5.87:1 on ground / 5.32:1 on wash; success on wash 4.55:1; warning on wash 4.85:1.
- Dark: text on surface 14.36:1; every accent 6.6–8.9:1 as text on dark surface.

### Image proof

Cool near-neutral grounds are the gallery convention for photographing warm objects — the ground recedes, the object advances. **Warm wood item:** maximum temperature contrast with the ground makes wood/leather the warmest thing on screen — it glows without saturation tricks. **Black electronics:** 14:1 separation; the cool cast echoes tech-product photography conventions. **White stock photo:** 1.08:1 tint + hairline border delineates the crop. The cast is ~1% chroma toward blue-gray — clearly not Lagoon's sea-tinted (green-blue) neutrals and imperceptible as a color shift on photos.

### Anti-AI audit

Action `#35577C` is low-chroma Prussian/denim — checked against row 2 (Tailwind `indigo-500 #6366F1`: violet-leaning, ~3× the chroma), row 3 (indigo-on-dark: this system is light-first), and row 8 (no glows, no glass): different hue angle, different saturation regime, different application. No purple (rows 1, 5, 13); AI accent is gold, not sparkle-purple (rows 37, 45); neutrals tinted, not zinc (row 9); no gradient anywhere (rows 1, 12, 19, 39).

---

## 3 · Bench

**Concept:** the workbench — waxed-canvas olive, tool-steel blue, a walnut handle. Where things get inspected, repaired, photographed, and sent back into the world.

### Tokens — light

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#F4F5F0` | Flint — green-cast off-white (the museum-wall neutral) |
| `--surface` | `#FFFFFF` | Cards, inputs |
| `--surface-elevated` | `#FFFFFF` | Modals, sheets |
| `--muted` | `#E8EAE1` | Shell, chips, skeletons |
| `--border` | `#D2D5C9` | Hairlines |
| `--border-strong` | `#ACB1A0` | Emphasized dividers |
| `--text-primary` | `#24271E` | Olive-black ink |
| `--text-secondary` | `#4E5346` | Labels, meta |
| `--text-placeholder` | `#878D7C` | Placeholders |
| `--text-inverse` | `#FFFFFF` | |
| `--action` | `#57641B` | Waxed-canvas olive — primary CTA, links |
| `--action-bright` | `#6F7C28` | Hover |
| `--action-dark` | `#414B10` | Pressed |
| `--action-soft` | `#EEF1DD` | Selected/wash |
| `--ai` | `#4A5E6B` | Tool steel — Porter / assistive |
| `--ai-soft` | `#E7EDF1` | AI wash |
| `--tertiary` | `#74522E` | Walnut — price/premium accents, condition chips |
| `--tertiary-soft` | `#F3ECE2` | |
| `--focus-ring` | `#4A5E6B` | |
| `--success` / wash | `#1F7A4C` / `#E2F1E9` | (spruce — blue-green, distinct from the yellow-green action) |
| `--warning` / wash | `#8F5B00` / `#F6EEDB` | |
| `--error` / wash | `#B0301F` / `#F8E7E4` | |

### Tokens — dark

| Token | Hex |
|---|---|
| `--ground` | `#161812` |
| `--surface` | `#1D2018` |
| `--surface-elevated` | `#252921` |
| `--border` | `#3B4034` |
| `--text-primary` | `#EEF0E9` |
| `--text-secondary` | `#BBC0B1` |
| `--text-placeholder` | `#8C917F` |
| `--action` (accent/text) | `#A9B84D`; button fill `#6F7C28` w/ white text |
| `--ai` | `#8FAEC4` |
| `--tertiary` | `#C79A66` |
| `--success` / `--warning` / `--error` | `#63BE8D` / `#E1A63C` / `#E78D7C` |

### Forms proof (computed)

- Body text `#24271E`: ground **13.85:1**, surface **15.17:1**, muted **12.49:1**. Secondary 7.23:1 on ground.
- White on olive action **6.47:1**; pressed 9.38:1; olive link text on ground 5.91:1. Focus ring steel `#4A5E6B` 6.76:1 vs white input — hue-distinct from action, error, and success simultaneously.
- Error 5.83:1 on ground / 5.33:1 on wash; success on wash 4.56:1; warning on wash 4.96:1; walnut tertiary 7.03:1 on white.
- Semantic legibility note: action olive and success spruce are separated in hue (yellow-green vs blue-green) *and* the success state always ships with wash + icon, so red-green-adjacent confusion is mitigated.
- Dark: text on surface 14.37:1; accents 6.5–8.2:1 as text on dark surface.

### Image proof

Green-gray is the classical gallery/museum wall neutral precisely because it is the complement-average of most object colors. **Warm wood item:** green-cast ground is the near-complement of wood's red-orange — the strongest flattering contrast of the three palettes; wood looks richest here. **Black electronics:** ~14:1 separation; the organic-neutral ground keeps hardware from feeling like a spec sheet. **White stock photo:** 1.10:1 tint (the largest of the three) — white crops are most visible on Bench even before the border token. Dark ground `#161812` is olive-black: photos sit like objects on an oiled bench, not pixels on OLED.

### Anti-AI audit

Olive/moss appears in **zero** rows of the clichés table — it is arguably the least machine-favored hue family in the entire 2025–26 corpus. Checked specifically against row 4 (acid/neon green on black: this olive is dark, desaturated, light-first), row 6 (ground is green-cast, not cream; accent is olive, not terracotta), row 7 (single dominant, no pastel spread), rows 9–10 (tinted neutrals). Steel-blue AI accent is gray-blue, not indigo (rows 2–3) and not cyan-glow (row 4).

---

## Cross-palette verification

| Check | Ledger | Selvedge | Bench |
|---|---|---|---|
| Base hue family vs warm-stone (orange-tinted) | rose-neutral (R≈B) ✓ distinct | cool blue-gray ✓ distinct | green-gray ✓ distinct |
| Base hue family vs Lagoon (deep teal, sea-tinted) | ✓ distinct | blue-gray ≠ teal-green ✓ | ✓ distinct |
| Purple/violet anywhere | none ✓ | none ✓ | none ✓ |
| Body text AA on every bg token | 12.6–15.4:1 ✓ | 12.7–15.2:1 ✓ | 12.5–15.2:1 ✓ |
| All accent/semantic text pairs ≥4.5:1 | ✓ (min 4.86) | ✓ (min 4.53) | ✓ (min 4.56) |
| Dark ramp complete + AA | ✓ (min 6.44) | ✓ (min 6.67) | ✓ (min 6.48) |

**Recommendation if forced to one:** **Ledger.** It carries the strongest brand story for a provenance/resale product, its oxblood action color has the most authority at 375px button sizes (8.28:1 — highest of the three), and its rose-neutral ground is the furthest hue distance from everything already presented while remaining photo-invisible. Selvedge is the safest crowd-pleaser; Bench is the most distinctive but its olive CTA is the biggest taste swing.

---

## v2 — Selvedge · Rivet (chosen direction, 2026-07-12)

Stephen picked Selvedge but keeps the DHG orange. In selvedge-world the orange is the **copper rivet**.

**Deltas from Selvedge v1** (everything else — ground, surfaces, text, dark ramp, semantics — unchanged):

| Role | Token | Light | Dark | Computed ratio |
|------|-------|-------|------|-------|
| Action fill | `--blaze` | `#FF5500` + **ink `#21262E` text** | `#FF7A38` + `#14171C` text | 4.74 / 6.92 |
| Action pressed / orange text | `--rivet-deep` | `#B34400` | — | 5.19 on ground, 5.61 w/ white |
| Orange wash | `--rivet-soft` | `#FDEBDD` (+`#B34400` text) | `rgba(255,122,56,.16)` | 4.84 |
| Interactive / links | `--denim` | `#35577C` | `#8FB0D4` | 6.92 / 8.0 |
| AI / Porter | denim family, wash `#E8EDF4` | | | |
| Tertiary | gold thread `#8A6712` | `#D5AF4B` | | 5.2 / 7.9 |
| Retired | juniper (success green owns that slot) | | | |

**Key rule:** blaze buttons carry ink text, never white — white-on-blaze fails AA (3.21); ink-on-blaze passes (4.74) and is the distinctive move (cliché table row: generic orange CTAs are white-text). Warning `#925C00` remains dark-amber *text*; blaze is always a *fill* — never adjacent in one control.
