# AI-Generated Design Clichés — The Permanent "Never" List

**Purpose:** negative-space checklist for all Portage design work. If a proposed palette, font, layout, element, or line of copy matches a row below, it reads as machine-made in 2025–2026 and is rejected by default. Exceptions require an explicit, argued waiver.

**Compiled:** 2026-07-11. Sources cited per cluster at the end of each section; the strongest single-page references are [Impeccable "Slop"](https://impeccable.style/slop/), [925 Studios AI-slop guide](https://www.925studios.co/blog/ai-slop-web-design-guide), [VibeCodeKit AI-slop design](https://vibecodekit.dev/ai-slop-design), and [prg.sh on the purple-gradient default](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website).

**Why the convergence exists (context for every row):** LLMs emit the statistical median of 2019–2024 tutorial code. Tailwind UI's original `bg-indigo-500` demo components saturated GitHub, Stack Overflow, and YouTube walkthroughs, so models "associate modern web design with purple because purple is statistically common in the training corpus" ([prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website), [dev.to/alanwest](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p)). Every row below is a symptom of that same distributional convergence.

---

## 1 · Color Palettes

| # | Category | Item | Why it reads AI-generated | Seen in |
|---|----------|------|---------------------------|---------|
| 1 | Color | Purple→blue / violet gradient (hero bg, CTA, headline text) | The single most-cited tell; direct descendant of Tailwind UI's `from-indigo-500 to-purple-600` demos replicated across the entire training corpus | v0/Lovable/Bolt output, every "AI startup" landing page |
| 2 | Color | Tailwind `indigo-500` buttons and `indigo-600` link text | The literal default Adam Wathan semi-apologized for; untouched framework default = nobody made a decision | AI-scaffolded Tailwind apps |
| 3 | Color | Indigo-on-dark SaaS scheme (near-black bg, indigo/violet accents, white text) | Fusion of tells #1 and #52; the "serious AI infra company" uniform of 2024–25 | AI dev-tool marketing sites |
| 4 | Color | Neon-on-near-black: acid green, electric cyan, glowing borders | "Cyberpunk = futuristic" is the model's one move for edgy; glow box-shadows do the work personality should | Crypto/AI-agent sites, vibe-coded dashboards |
| 5 | Color | "Vibecode purple" — lavender tint bleeding into grays, borders, shadows | Purple leaks into *neutrals* because generated shadow/border values inherit the accent hue | Purple-tinted `box-shadow: rgba(124,58,237,…)` everywhere |
| 6 | Color | Warm cream/beige ground + terracotta/rust accent | Became the machine's one "tasteful, non-SaaS" alternative; Impeccable calls cream "the default tasteful AI surface" — it's now as templated as indigo | "Calm" AI wellness/journal apps, AI brand kits |
| 7 | Color | Pastel startup rainbow — each feature card its own pastel tint | Color used as decoration-per-card instead of as a system; screams generated section, not designed brand | Feature grids from AI site builders |
| 8 | Color | Glassmorphic blue glow (translucent panels over blue/violet radial glows) | Depth faked with glow instead of earned with hierarchy; default "premium" texture in generated CSS | Fintech/AI hero sections |
| 9 | Color | Untouched shadcn/ui zinc-slate grays | Ships with every scaffold; a whole app in default zinc says no palette decision was ever made | shadcn-based generated apps |
| 10 | Color | Pure `#FFFFFF` / pure `#000000` grounds with no tinted ramp | Models default to extremes when no system is specified; real design systems tint their neutrals toward the brand | Quick AI one-pagers |
| 11 | Color | Timid, evenly-balanced palette — 3–4 accents at equal weight, no dominant | Statistical averaging produces "a bit of everything"; human systems commit to one dominant + subordinates | AI brand-kit generators |
| 12 | Color | Gradient-filled stat numbers / metric text | "Make the number pop" solved the same way every time; gradient text is decoration with no informational role | Generated pricing/stats sections |
| 13 | Color | Purple-tinted drop shadows | Accent hue leaking into elevation; shadows should be neutral or ground-tinted | Tell #5's shadow-specific variant |
| 14 | Color | Dark-mode-only launch | "Dark = premium dev tool" reflex; ignores context (forms, photos, print) — a default posture, not a decision | AI dev-tool launches, vibe-coded portfolios |

Sources: [Impeccable Slop](https://impeccable.style/slop/) · [prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website) · [dev.to/alanwest](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p) · [VibeCodeKit](https://vibecodekit.dev/ai-slop-design) · [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) · [superdesign.dev](https://superdesign.dev/blog/why-ai-design-looks-generic)

---

## 2 · Fonts & Typography

| # | Category | Item | Why it reads AI-generated | Seen in |
|---|----------|------|---------------------------|---------|
| 15 | Font | Inter for everything | The most statistically common font in the training data; "so ubiquitous it reads as default rather than designed" | Nearly all generated UI |
| 16 | Font | Space Grotesk display headlines | The model's one "quirky but safe" display pick; now a co-tell with Inter | AI/crypto brand sites |
| 17 | Font | Poppins / Montserrat geometric sans | "The three most overused AI logo fonts" (with Inter); rounded geometry = generic-friendly | AI logo generators, template sites |
| 18 | Font | Sora, Geist, generic neo-grotesk defaults | Framework-adjacent defaults (Geist ships with Vercel); picking the toolchain's font is not a typography decision | Next.js/v0 output |
| 19 | Font | Gradient-filled display text | Tell #12 applied to headlines; maximum "AI startup" signal per character | Generated hero H1s |
| 20 | Font | Single italic-serif accent word inside a sans headline ("Ship *faster*") | 2024–25 micro-trend absorbed and repeated verbatim; usually Instrument Serif italic | AI landing-page templates |
| 21 | Font | One typeface, flat hierarchy — sizes too close together, weight-only differentiation | Models don't feel hierarchy; they emit plausible size tokens with no rhythm | Generated dashboards and docs |
| 22 | Font | ALL-CAPS letter-spaced "kicker" labels above every section heading | Scaffolding repeated at every section because it appeared once in the pattern | "FEATURES", "HOW IT WORKS", "PRICING" kickers |
| 23 | Font | Decorative monospace body/labels "for the hacker vibe" | Monospace as costume, not for tabular/code content | AI dev-tool sites |
| 24 | Font | Oversized ultra-bold hero headline, tight tracking, vague claim | The 96px "Build the future of work" pattern — typographic confidence pasted over content emptiness | Every generated hero |

Sources: [Impeccable Slop](https://impeccable.style/slop/) · [madegooddesigns font trends 2026](https://madegooddesigns.com/font-trends-2026/) · [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) · [VibeCodeKit](https://vibecodekit.dev/ai-slop-design)

---

## 3 · UI Layouts

| # | Category | Item | Why it reads AI-generated | Seen in |
|---|----------|------|---------------------------|---------|
| 25 | Layout | Centered hero: badge pill above H1, subhead, two CTAs (primary + ghost) | The literal opening move of nearly every generated page; VibeCodeKit names "badge directly above H1" as a distinct tell | All AI site builders |
| 26 | Layout | Exactly three feature cards in a row (icon, title, two-line blurb) | The training corpus's modal feature section; three is the statistically safest count | Everywhere since 2019 Tailwind demos |
| 27 | Layout | Bento grid feature section | 2023 Apple-keynote trend at full saturation — ~67% of top ProductHunt SaaS now use it; equal-sized bento cells are "a traditional grid with rounded corners" | B2B SaaS homepages |
| 28 | Layout | Full-page skeleton: hero → 3 cards → logo strip → testimonials → pricing trio → FAQ → footer | The entire page as one memorized template; structure identical across products with nothing product-specific | Generated landing pages |
| 29 | Layout | Endless full-width alternating text-left/image-right sections | Infinite scroll of undifferentiated 50/50 splits; no editorial pacing | Long generated marketing pages |
| 30 | Layout | Floating glass cards over gradient orbs/mesh | Combines tells #8, #40, #41; layered "depth" with zero content hierarchy | AI fintech heroes |
| 31 | Layout | Testimonial carousel — avatar, five stars, italic quote | Social proof as a memorized widget; often with generated faces | Template + AI sites |
| 32 | Layout | Pricing-table trio with highlighted middle "Most Popular" card | Three columns, middle scaled 105% with accent border — emitted identically every time | Generated pricing pages |
| 33 | Layout | Hero-metric stat banner (big gradient number, tiny label, ×3) | "10K+ users · 99.9% uptime · 4.9 rating" row; metrics as decoration | Generated credibility sections |
| 34 | Layout | Numbered section markers 01 / 02 / 03 | Editorial-design scaffolding applied without the editorial content it exists to organize | "How it works" sections |
| 35 | Layout | "Trusted by" grayscale logo cloud (often placeholder logos) | Ritual credibility strip; models emit it even when there are no customers | Generated B2B pages |
| 36 | Layout | Cards nested inside cards inside cards | Each generation pass wraps content in another container; 3–5 levels of padding+border+shadow ("cardocalypse") | Vibe-coded dashboards |

Sources: [VibeCodeKit](https://vibecodekit.dev/ai-slop-design) · [saasframe.io bento guide](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide) · [pravinkumar.co bento trend](https://www.pravinkumar.co/blog/bento-grids-b2b-saas-homepage-design-trend-2026) · [Impeccable Slop](https://impeccable.style/slop/) · [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide)

---

## 4 · Page Elements & Styles

| # | Category | Item | Why it reads AI-generated | Seen in |
|---|----------|------|---------------------------|---------|
| 37 | Element | Sparkle ✨ iconography on anything AI-powered | The industry-wide "this is the AI part" glyph; pure convention, zero brand | Every AI feature button 2023–26 |
| 38 | Element | Emoji as section markers / list bullets (🚀 ⚡ 🎯) | LLM writing habit ported into UI; reads as chat output, not product design | Generated READMEs, landing sections |
| 39 | Element | Gradient blob / mesh-gradient background | The one "organic" texture in the training set; abstract 3D blobs floating in space | Hero backgrounds everywhere |
| 40 | Element | Glassmorphism everywhere (blur + white/10 border on all surfaces) | A material meant for one chrome layer applied to every card; texture replacing hierarchy | Generated dashboards |
| 41 | Element | Neumorphism (soft-extruded inset/outset controls) | Zombie 2020 trend the corpus keeps resurrecting; fails contrast and affordance | AI "concept" UI shots |
| 42 | Element | Uniform `rounded-lg`/`rounded-2xl` on every element | One radius token everywhere = no shape hierarchy; the untouched `rounded-2xl shadow-lg p-6` shadcn card | All generated UI |
| 43 | Element | Colored 3–4px left/side accent bar on cards | Called "the single most recognizable tell of AI-generated UI" — the thick stripe clashing with the rounded radius | Generated stat/alert/info cards |
| 44 | Element | Flat 1px same-gray border on every card and section | Border as reflex, not as separation logic | shadcn-default output |
| 45 | Element | "AI" badge / "Powered by AI" pill in nav or hero | Announcing the technology instead of the benefit; often paired with tell #37 | AI-feature launches |
| 46 | Element | Typing-dots animation / shimmer skeleton as brand personality | Chat-app furniture treated as delight; personality borrowed from ChatGPT itself | AI assistant UIs |
| 47 | Element | Oversized centered Lucide icon in a tinted rounded tile above each heading | "Massive icons larger than the content they introduce"; icon tiles as filler | Feature cards everywhere |
| 48 | Element | Floating 3D abstract blobs / overly-smooth "plastic" illustrations | AI-generated art tells: too smooth, too symmetrical, no texture of a human hand | Generated hero art, stock-AI illustration |
| 49 | Element | Bounce/elastic easing on dialogs; identical fade-in-on-scroll on every block | "Motion without meaning" — when in doubt, animate everything, uniformly | Framer/AI-generated motion |
| 50 | Element | Hover scale/rotate transform on images and cards | The one hover idea in the corpus; applied to elements where zoom means nothing | Generated galleries and cards |
| 51 | Element | Dark glass sticky nav (`backdrop-blur` + `border-white/10`) | The default generated navbar regardless of brand or context | All dark-mode generated sites |
| 52 | Element | Drop shadows with accent tint (usually purple) at 0.1 opacity | See #5/#13 — elevation inheriting brand hue is a generated-CSS signature | Vibe-coded component libraries |

Sources: [Impeccable Slop](https://impeccable.style/slop/) · [VibeCodeKit](https://vibecodekit.dev/ai-slop-design) · [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) · [smoothui.dev](https://smoothui.dev/blog/ai-design-slop) · [theadpharm.com](https://www.theadpharm.com/insights/claude-design-without-the-ai-slop-look)

---

## 5 · Copy & Voice (bonus)

| # | Category | Item | Why it reads AI-generated | Seen in |
|---|----------|------|---------------------------|---------|
| 53 | Copy | "Supercharge / Unleash / Unlock / Elevate" verbs | The LLM hype-verb cluster; intensity substituting for specificity | Generated hero copy |
| 54 | Copy | "Seamlessly / effortlessly / blazingly fast" adverbs | Frictionless-claim filler; no product ever demonstrates "seamlessly" | Feature blurbs |
| 55 | Copy | Em-dash overuse — clause after clause — like this | The famous "ChatGPT hyphen"; a punctuation crutch connecting ideas that want separate sentences | All AI-drafted copy ([Rolling Stone](https://www.rollingstone.com/culture/culture-features/chatgpt-hypen-em-dash-ai-writing-1235314945/), [TechCrunch](https://techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/)) |
| 56 | Copy | Triadic feature naming ("Capture. Organize. Sell.") | The rule-of-three emitted mechanically; three single-verb fragments with terminal periods is the giveaway cadence | Hero subheads, feature kickers |
| 57 | Copy | Vague aspirational hero claim ("Build the future of work") | Maximum ambition, zero referent; the statistical average of every hero headline | Generated H1s |
| 58 | Copy | "Your all-in-one platform" / "Scale without limits" | Stock positioning phrases the corpus repeats verbatim | Generated subheads |
| 59 | Copy | Aphoristic contrast copy ("It's not X. It's Y.") | Manufactured-profundity cadence; Impeccable flags it as a slop signature | AI-drafted marketing and LinkedIn posts |
| 60 | Copy | "Best-in-class / enterprise-grade / cutting-edge / world-class" | Superlatives without evidence; hedge-and-hype vocabulary of generated sales copy | Everywhere |

Sources: [Impeccable Slop](https://impeccable.style/slop/) · [925 Studios](https://www.925studios.co/blog/ai-slop-web-design-guide) · [Rolling Stone](https://www.rollingstone.com/culture/culture-features/chatgpt-hypen-em-dash-ai-writing-1235314945/) · [plagiarismtoday.com](https://www.plagiarismtoday.com/2025/06/26/em-dashes-hyphens-and-spotting-ai-writing/)

---

## How to use this table

1. **Palette review:** any proposed color system is checked against rows 1–14 before evaluation on merit.
2. **Component review:** new components are linted against rows 37–52 (especially #37 sparkles, #42 uniform radius, #43 accent bars — the highest-frequency tells).
3. **Copy review:** marketing and in-app strings are checked against rows 53–60.
4. **Waivers:** a match is not an automatic veto if the element is load-bearing for usability (e.g., shimmer skeletons for loading, #46 — keep the mechanic, strip the "personality" framing). The waiver must name the row and the reason.

Note for Portage specifically: the current design system already carries a few near-misses worth watching — glass-morphism tiers (row 40; acceptable while confined to the tab bar/chrome layer, a violation if it spreads to cards), confetti celebrations, and any future temptation to badge Porter features with sparkles (row 37 — Porter's identity should come from voice and color, never ✨).
