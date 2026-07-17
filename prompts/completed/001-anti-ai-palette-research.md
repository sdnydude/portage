<objective>
Two deliverables, in this order:

1. **Research:** Build an exhaustive reference table of overused "AI-generated design" tells — the color palettes, fonts, UI layouts, and page elements that make a page read as machine-made in 2025–2026. This table becomes a permanent negative-space checklist for all future Portage design work.
2. **Recommend:** Using that table as an exclusion filter, recommend your top THREE complete color palettes for Portage that are NOT among those already presented (the current DHG warm-stone system, tonight's 15 background proposals, and the Lagoon palette are all off the table).

The research comes first because it defines the exclusion space the recommendations must clear.
</objective>

<context>
Portage is a mobile-first personal-effects inventory and multi-marketplace seller app (DHG / Stephen Webber). Two environments dominate every screen and constrain the palette:
- **Forms environment:** dense listing/editing forms — inputs, chips, pills, validation states, long scrolls at 375px width.
- **Image environment:** user photo–heavy surfaces (item galleries, listing cards, PNG share cards) where unpredictable real-world product photos sit directly on app backgrounds.

The palette must project **digital–human harmony**: technology that feels warm, trustworthy, and hand-held — not sterile SaaS, not synthetic futurism.

Reference material in this repo:
- @website/docs/design/style-guide.md — the current DHG Design System v1 (excluded from recommendations, but its token structure is the template your palettes must fill)
- @apps/web/src/app/globals.css — how tokens are actually consumed

Suggested support: use web search/fetch for the research phase; a design-review pass with @systems-architect or the design:design-critique skill is optional for the final three.
</context>

<research_requirements>
Thoroughly explore multiple online sources (design-community critiques, "why does every AI site look the same" essays, Dribbble/Twitter design discourse, framework-default critiques). Compile ONE table with these columns: **Category · Item · Why it reads AI-generated · Seen in**. Cover at minimum:

- **Color palettes:** purple/violet-to-blue gradients, indigo-on-dark SaaS, neon-on-near-black (acid green, cyan), warm cream + terracotta, pastel "startup rainbow", glassmorphic blue glows, etc.
- **Fonts:** Inter-everywhere, Space Grotesk, Poppins, Montserrat, Sora, generic geometric sans defaults, gradient-filled display text.
- **UI layouts:** centered hero + 3-feature-card row, bento grids, endless full-width alternating sections, floating glass cards, testimonial carousels, pricing-table trios.
- **Page elements & styles:** emoji section markers, sparkle/✨ iconography, gradient blobs/mesh backgrounds, glassmorphism, neumorphism, rounded-lg-everything, accent bar on cards, dark-mode-only launches, "AI" badges, typing-dots effects, oversized border radii, drop shadows with purple tint.
- **Copy/voice tells** (bonus category): "Supercharge", "Unleash", "Seamlessly", em-dash overuse, triadic feature naming.

Exhaustive means: a designer could use this table alone as a lint checklist. Aim for 40+ rows. Cite the strongest sources inline (URL per row or per cluster).
</research_requirements>

<recommendation_requirements>
Exactly three palettes. For each:

1. **Name + one-line concept** rooted in Portage's world (personal effects, resale, craft, provenance — not generic tech metaphors).
2. **Full token set** mirroring the DHG v1 structure: base/ground, surface ramp (light), full dark ramp, primary text + secondary + muted, one action color, one assistive/AI color, tertiary accent, borders, 4 semantic states + washes. Hex for everything.
3. **Forms proof:** show the palette passes the forms environment — input bg vs page bg separation, focus ring, error/success states legible at small sizes, WCAG AA for body text on every background token.
4. **Image proof:** explain why the ground flatters unpredictable user photos (neutral enough to not fight product colors; test claim against a warm wood item, a black electronics item, and a white-background stock photo).
5. **Anti-AI audit:** one line per palette explicitly clearing it against your own research table.

Hard exclusions: anything substantially similar to DHG warm-stone, the Lagoon system, or any row of your research table. No purple/violet anywhere. Deeply consider multiple directions before settling on three — reject your first instincts if they appear in the table.
</recommendation_requirements>

<output>
- `./research/ai-design-cliches.md` — the exhaustive table with sources.
- `./research/portage-palette-candidates.md` — the three palettes, full token sets, proofs, and audit.
- One rendered swatch page (HTML artifact or file) showing all three palettes with on-color text samples and a mock ListingCard in each — same format as tonight's Lagoon artifact so they compare directly.
</output>

<verification>
Before declaring complete:
- Research table has 40+ rows across all five categories, each with a "why" that is specific, not circular.
- Every recommended hex passes AA (4.5:1) for its designated text pairing — show the computed ratios for at least ground/surface/action tokens.
- Each palette's anti-AI audit names the specific table rows it was checked against.
- None of the three shares a base hue family with warm-stone (orange-tinted neutrals) or Lagoon (deep teal).
</verification>

<success_criteria>
Stephen can (a) pin the clichés table to the style guide as a permanent "never" list, and (b) pick one of the three palettes and hand it straight to implementation with zero missing tokens.
</success_criteria>
