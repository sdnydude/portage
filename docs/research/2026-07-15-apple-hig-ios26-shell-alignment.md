# Apple HIG (iOS 26 / Liquid Glass) — Responsive Shell Alignment Research

**Date:** 2026-07-15
**Method:** Direct fetches of developer.apple.com/design/human-interface-guidelines pages (tab-bars, sidebars, materials, layout, accessibility, typography, navigation-and-search, multitasking) + SwiftUI `sidebarAdaptable` docs. Items marked UNVERIFIED could not be confirmed against live HIG body text this session.
**Purpose:** Align the Portage responsive shell (Phase R0) with current Apple HIG ahead of the native iOS app that follows the responsive overhaul + onboarding hub.

## Findings

### 1. Tab bars (iOS 26)
The iOS 26 tab bar floats above content on a Liquid Glass background — no longer edge-glued/opaque. Minimize-on-scroll is a first-class behavior (`TabBarMinimizeBehavior` / `UITabBarController.MinimizeBehavior`): scroll-down collapses the bar, tab tap or scroll-to-top restores it. Guidance: "a default list of five or fewer" tabs — overflow silently becomes a hidden "More" tab (anti-pattern). A dedicated "accessory" shelf can sit above the bar and persist across tabs. Include single-word labels.
Source: https://developer.apple.com/design/human-interface-guidelines/tab-bars

### 2. iPadOS tab bar ↔ sidebar adaptivity
`sidebarAdaptable`: iPad shows the top tab bar and lets it become a sidebar (toggle included, user-customizable tab placement); iPhone keeps the tab bar; macOS adopts the standard sidebar. Prefer a tab bar first unless many peer destinations/deep collections earn a sidebar. "Show no more than two levels of hierarchy in a sidebar" — deeper goes to split view. No concrete landscape/portrait breakpoint numbers published in HIG prose (UNVERIFIED — those live in size-class API docs).
Sources: https://developer.apple.com/design/human-interface-guidelines/sidebars · https://developer.apple.com/documentation/SwiftUI/TabViewStyle/sidebarAdaptable

### 3. Layout fundamentals
Control sizes (Accessibility page): **default 44×44 pt; accessibility-floor minimum 28×28 pt**; ~12 pt padding around bezeled elements, ~24 pt around bezel-less ones. Safe area = region not covered by bars/system chrome (Dynamic Island, Home indicator, corner radii). "Respect system-defined safe areas, margins, and guides." Exact numeric layout-margin values: UNVERIFIED on the live page.
Sources: https://developer.apple.com/design/human-interface-guidelines/accessibility · https://developer.apple.com/design/human-interface-guidelines/layout

### 4. Materials / Liquid Glass
Liquid Glass = floating layer for controls/navigation (tab bars, sidebars) above content; content peeks through while staying legible. Variants: **Regular** (blur + luminosity adjustment — use for text-carrying chrome: sidebars, alerts, popovers) and **Clear** (highly translucent, media-rich backgrounds; add ~35% dark dimming over bright media). Hard rule: **"Don't use Liquid Glass in the content layer"** (cards, rows) — chrome only, and sparingly. Reduce Transparency / Increase Contrast change how the material renders — expected behavior, not an edge case.
Source: https://developer.apple.com/design/human-interface-guidelines/materials

### 5. Typography
SF (Pro/Compact/Mono) + New York; variable fonts; avoid Ultralight/Thin/Light for legibility. Minimum legible size iOS/iPadOS: **11 pt**. Dynamic Type: 7 standard + 5 accessibility sizes; layout/icons/truncation must adapt across the range. Web analog: 16px-and-up body text is a reasonable mirror (inference, not Apple prose).
Source: https://developer.apple.com/design/human-interface-guidelines/typography

### 6. Navigation & search
Live `navigation-and-search` and `sheets` pages returned only scaffolding on fetch — detents, back-swipe, modal-vs-push rules UNVERIFIED this session. Partial: "If search is important, give it a primary position"; in tab-bar apps search is a dedicated tab (Photos, Apple TV). iOS 26 system apps (Messages/Mail/Notes/Music/Phone) shipped bottom-anchored search per contemporaneous reporting — directional signal, not citable HIG prose.

### 7. Accessibility (layout-relevant)
Contrast: ≤17 pt text 4.5:1 minimum; ≥18 pt or bold 3:1. Reduce Motion: reduce automatic/repetitive animation — fades over transitions, gesture-tracked not automatic motion, no z-axis depth changes, no blur animation. Reduce Transparency / Increase Contrast alter Liquid Glass rendering.
Source: https://developer.apple.com/design/human-interface-guidelines/accessibility

### 8. Verdicts on the Portage shell as designed
- **Floating inset glass bottom bar:** VALIDATED — literally the iOS 26 default direction.
- **6 tabs + center circular Scan button:** CONTRADICTED on count (target ≤5) and the center FAB has no documented Apple pattern (closest idiom = accessory shelf above the bar) — keeping it is a deliberate deviation, not HIG-aligned.
- **Persistent floating Home chip on tab-bar-less pages:** NOT SUPPORTED by HIG — Apple's model is the tab bar itself, minimized but never fully absent, as the return path.
- **Collapsible sidebar (240px/72px):** direction VALIDATED (`sidebarAdaptable`, hide-to-reclaim-space endorsed); the px figures are Portage choices, not Apple numbers.
- **Focus-expanding AI input in top bar:** no HIG precedent either way (UNVERIFIED territory).

## Deltas applied / decided for Phase R0

1. Tab count ≤5 — decision Stephen (recommend: 5 tabs, More → avatar in page header).
2. Center Scan FAB — decision Stephen (recommend: keep as documented deliberate deviation).
3. Home chip vs minimized-bar pattern on tab-bar-less pages — decision Stephen (recommend: minimized bar, retire chip).
4. Adopt minimize-on-scroll for the mobile bar (fade-based under reduced motion).
5. Glass semantics: Regular-variant treatment for chrome only; never glass on content cards.
6. `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` as real render paths.
7. Touch targets: 44 pt default (28 pt absolute floor), 12/24 pt spacing rules in bar + icon-rail rows.
8. Native-port note: bottom-anchored primary search is the iOS 26 system-app convention — supports bottom-area Ask Porter placement.
