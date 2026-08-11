# DHG Website Program Kickoff — spec, repo, moat research

**Session span:** 2026-07-22 morning → afternoon
**Category:** feature (planning + scaffold)

## Story

Stephen opened a new workstream: DHG's first external website — corporate site for
the company (SMB-focused services: CME production, AI consulting via In Tune AI,
development/production) plus a separate consumer-facing Portage landing page. He
asked for the most effective way to use Fable: Claude Design, agents, or something
else.

First answer contained two guesses ("no Claude Design product exists", "deploy to
Cloudflare Pages") — both wrong. Stephen enforced research-before-asserting;
correction captured. Research established: Claude Design is a real Anthropic Labs
product (claude.ai Design tab, design-system imports, hand-off to Claude Code, with
a DesignSync tool available in-session), and Cloudflare's 2026 guidance is Workers
static assets, not Pages, for new projects.

A 6-step plan was approved: spec → repo scaffold → design system into Claude
Design → R4 build → asset capture → launch. Audience/messaging matrix approved for
both sites. Competitive research confirmed Vendoo and List Perfectly have no public
APIs — both are Chrome-extension form-fillers — giving Portage moat #2 (real
marketplace APIs, publishes from phone). Stephen added moat #3: desktop↔phone
continuity; code check showed Continuity Camera shipped (PR #220) but QR pairing
(R4) unbuilt — decision: R4 is a launch prerequisite because the hero demo video
(phone scan → desktop listing) depends on it.

Spec written and redlined same session: CTA "Become a Beta Tester", real pricing
tiers on landing, domain digitalharmonyai.com (registered at Cloudflare — an
earlier GoDaddy inference from a parked-page CSP header was wrong, second
correction captured), heroes approved. Repo `sdnydude/dhg-web` scaffolded: Astro 7
npm-workspaces monorepo, two sites, Workers static-assets wrangler configs, builds
green, pushed. Framework decision: Astro over Next.js (Cloudflare acquired Astro
Jan 2026; 2–3× faster content sites, ~9KB JS). Stray `public-web/` shell deleted
from portage repo with approval.

Session ended with handoff written to dhg-web `whats-next.md`; next session resumes
at step 3 (DesignSync package of DHG Design System v1 into Claude Design project).

## Learnings

- CSP/frame-ancestors headers on a parked page identify the lander template, not
  the domain registrar — verify registrar via whois/RDAP or ask.
- Claude Design + DesignSync: design-system projects on claude.ai can be synced
  incrementally from a local component library; visual iteration happens in the
  Design tab, hand-off lands back in Claude Code.
- Cloudflare 2026: new projects deploy to Workers static assets; Pages is
  maintenance-mode guidance. Astro is CF-owned as of Jan 2026.

## Insights

- Vendoo and List Perfectly (top crosslisting competitors) have no public APIs —
  both automate via Chrome-extension form-filling: desktop-bound, fragile to
  marketplace HTML changes. Portage's server-side official-API publishing is a
  structural moat competitors cannot copy without rebuilding.
- A "Become a Beta Tester" CTA converts marketing-honesty problems (parked Etsy,
  unbuilt analytics) into legitimate roadmap promises to testers.

## Deferred

- Q2: analytics claim framing (beta-roadmap vs pre-launch build) — recommendation
  made (beta-roadmap), Stephen confirmation pending.
- Q5: CME credentials/proof points for DHG services copy — discussion needed.
- Confirm portage.digitalharmonyai.com subdomain choice.
- First wrangler deploy + DNS — held for Stephen's explicit go.
- R4 QR pairing build (portage repo) — launch prerequisite, not started.
