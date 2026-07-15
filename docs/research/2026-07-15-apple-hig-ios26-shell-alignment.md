# Apple HIG (iOS 26 / Liquid Glass) — Responsive Shell Alignment Research

**Date:** 2026-07-15
**Method:** Direct fetches of developer.apple.com/design/human-interface-guidelines pages (tab-bars, sidebars, materials, layout, accessibility, typography, navigation-and-search, multitasking) + SwiftUI `sidebarAdaptable` docs, later supplemented with the `/tutorials/data/.../<page>.json` data-endpoint technique (see §9) to pull full body prose past the JS-SPA scaffolding for layout, sheets, multitasking, search-fields, toolbars, gestures, and modality. Items still marked UNVERIFIED could not be confirmed against live HIG body text even after that follow-up pass.
**Purpose:** Align the Portage responsive shell (Phase R0) with current Apple HIG ahead of the native iOS app that follows the responsive overhaul + onboarding hub.

## Findings

### 1. Tab bars (iOS 26)
The iOS 26 tab bar floats above content on a Liquid Glass background — no longer edge-glued/opaque. Minimize-on-scroll is a first-class behavior (`TabBarMinimizeBehavior` / `UITabBarController.MinimizeBehavior`): scroll-down collapses the bar, tab tap or scroll-to-top restores it. Guidance: "a default list of five or fewer" tabs — overflow silently becomes a hidden "More" tab (anti-pattern). A dedicated "accessory" shelf can sit above the bar and persist across tabs. Include single-word labels.
Source: https://developer.apple.com/design/human-interface-guidelines/tab-bars

### 2. iPadOS tab bar ↔ sidebar adaptivity
`sidebarAdaptable`: iPad shows the top tab bar and lets it become a sidebar (toggle included, user-customizable tab placement); iPhone keeps the tab bar; macOS adopts the standard sidebar. Prefer a tab bar first unless many peer destinations/deep collections earn a sidebar. "Show no more than two levels of hierarchy in a sidebar" — deeper goes to split view. No concrete landscape/portrait breakpoint numbers published in HIG prose (UNVERIFIED — those live in size-class API docs).
**Verified in follow-up:** the *layout* page independently recommends the identical pattern under the name "convertible tab bar": *"For many apps, you don't need to choose between a tab bar or sidebar for navigation; instead, you can adopt a style of tab bar that provides both. The app first launches with your choice of a sidebar or a tab bar, and then people can tap to switch between them. As the view resizes, the presentation style changes to fit the width of the view."* This is a second, independent HIG citation for the sidebar↔tab-bar adaptivity decision (not just the `sidebarAdaptable` API doc).
Sources: https://developer.apple.com/design/human-interface-guidelines/sidebars · https://developer.apple.com/documentation/SwiftUI/TabViewStyle/sidebarAdaptable · layout.json (see §3)

### 3. Layout fundamentals
Control sizes (Accessibility page): **default 44×44 pt; accessibility-floor minimum 28×28 pt**; ~12 pt padding around bezeled elements, ~24 pt around bezel-less ones. Safe area = region not covered by bars/system chrome (Dynamic Island, Home indicator, corner radii). "Respect system-defined safe areas, margins, and guides." Exact numeric layout-margin values for iOS/iPadOS: **confirmed absent** — the full 25,108-char layout.json body (fetched in follow-up, no longer just the 4,200-char skim) contains zero iOS/iPadOS margin point values. The only numeric spacing figures on the page are platform-specific and don't apply to a mobile web shell: tvOS safe area (60 pt inset top/bottom, 80 pt sides), tvOS grid layouts (40 pt horizontal / 100 pt minimum vertical spacing between focusable rows), and visionOS button spacing (buttons ≥60 pt apart, centers). **Remains UNVERIFIED for iOS/iPadOS numeric margins** — this is a confirmed gap in HIG prose, not a research miss.

**Window-resize/adaptation guidance (new, from full layout.json body) — directly validates the breakpoint-based responsive-shell approach:**
- *"As someone resizes a window, defer switching to a compact view for as long as possible. Design for a full-screen view first, and only switch to a compact view when a version of the full layout no longer fits."* — i.e., prefer the widest layout until it breaks, not the narrowest-first mobile convention. For complex layouts (split views), "prefer hiding tertiary columns such as inspectors as the view narrows."
- *"People can freely resize windows down to a minimum width and height, similar to macOS window behavior."* iPad windowed apps must handle the **full continuous range**, not fixed breakpoints: "Test your layout at common system-provided sizes... Window controls provide the option to arrange windows to fill halves, thirds, and quadrants of the screen... minimize unexpected UI changes as people adjust down to the minimum and up to the maximum window size."
- Nuance for the Portage decision: Apple's own mandate is *behavior-based* ("adapt gracefully, defer collapse, minimize jarring changes at any size") rather than *breakpoint-based*. CSS media-query breakpoints are a reasonable **implementation technique** to satisfy that mandate on the web, but they are Portage's engineering choice, not literally what HIG prescribes — Apple's native equivalent is continuous auto-layout/size-class adaptation, not discrete breakpoints. Treat "breakpoint-based iPad" as HIG-compatible, not HIG-specified.
- Also confirmed: "Avoid full-width buttons... inset from the edges of the screen"; "Avoid placing controls or critical information at the bottom of a window" (windowed macOS/iPad — people drag windows so the bottom edge goes offscreen — this is about **floating windows**, not applicable to Portage's fixed-viewport mobile web shell, noting so it isn't misapplied to the bottom tab bar decision).
Sources: https://developer.apple.com/design/human-interface-guidelines/accessibility · https://developer.apple.com/design/human-interface-guidelines/layout (full body, layout.json) · https://developer.apple.com/design/human-interface-guidelines/multitasking (multitasking.json, see §6)

### 4. Materials / Liquid Glass
Liquid Glass = floating layer for controls/navigation (tab bars, sidebars) above content; content peeks through while staying legible. Variants: **Regular** (blur + luminosity adjustment — use for text-carrying chrome: sidebars, alerts, popovers) and **Clear** (highly translucent, media-rich backgrounds; add ~35% dark dimming over bright media). Hard rule: **"Don't use Liquid Glass in the content layer"** (cards, rows) — chrome only, and sparingly. Reduce Transparency / Increase Contrast change how the material renders — expected behavior, not an edge case.
Source: https://developer.apple.com/design/human-interface-guidelines/materials

### 5. Typography
SF (Pro/Compact/Mono) + New York; variable fonts; avoid Ultralight/Thin/Light for legibility. Minimum legible size iOS/iPadOS: **11 pt**. Dynamic Type: 7 standard + 5 accessibility sizes; layout/icons/truncation must adapt across the range. Web analog: 16px-and-up body text is a reasonable mirror (inference, not Apple prose).
Source: https://developer.apple.com/design/human-interface-guidelines/typography

### 6. Navigation, search & sheets
**`navigation-and-search.json` structure resolved:** it is not a content page — it's a `collectionGroup` landing page (`topicSectionsStyle: "hidden"`) whose entire `primaryContentSections` is a `compactGrid` of links to five child pages: `path-controls`, `search-fields`, `sidebars`, `tab-bars`, `token-fields`. There is no prose to extract from this page itself; the real guidance lives in the children. `path-controls.json` was checked and is **not applicable** — path controls are an AppKit-only breadcrumb control ("Not supported in iOS, iPadOS, tvOS, visionOS, or watchOS"). The useful children were `search-fields.json`, plus `toolbars.json`, `gestures.json`, and `modality.json` (reached via topic cross-references, not the index page) for back-button/modal semantics, and `navigation-bars.json` 301-redirects to `toolbars.json` (navigation-bar guidance was folded into the toolbars page per its changelog: "incorporated navigation bar guidance," June 9 2025).

**Search placement — CONFIRMED, full HIG prose (search-fields.json), not directional inference:**
Three placement patterns, chosen by app shape:
1. **Tab in the tab bar** — two styles: *standard tab* (dedicated search landing page, good for rich/browsable content — Apple TV, Music) vs. *button appearance* (tap jumps straight to a focused search field + keyboard, transient, returns to the previous tab on exit).
2. **Toolbar, top or bottom** — *"Place search at the bottom if there's room... useful in any situation where search is a priority"* (Settings uses it as the only bottom item; Mail/Notes alongside other controls). *"Place search at the top when it's important to defer to content at the bottom of the screen, or there's no bottom toolbar"* (Wallet's example: passes stack at the bottom needs to stay reachable).
3. **Inline with content** — placed directly next to the list/view it filters, used when an app has more than one search field and location matters to scope (Music's library filter vs. its main search tab).
iPad/Mac: trailing edge of the toolbar for cross-column search (Mail, Notes, Voice Memos), or top of the sidebar when filtering navigation itself (Settings).
This supersedes the old "directional signal, not citable HIG prose" caveat — it is now citable prose, and it directly supports Portage's bottom-anchored Ask Porter placement (pattern 2, "place search at the bottom if there's room").

**Back button / back-swipe — CONFIRMED (gestures.json + toolbars.json):**
- *"In an app that supports navigation through a hierarchy of views, people expect to find a Back button in a top toolbar that lets them return to the previous view with a single tap. To help accelerate this action, many apps also offer a shortcut gesture — such as swiping from the side of a window or touchscreen — while continuing to provide the Back button."* (gestures.json, "Use shortcut gestures to supplement standard gestures, not replace them.")
- toolbars.json is explicit that Back and Close are semantically distinct and both required as standard components: *"People know that the standard Back button lets them retrace their steps through a hierarchy of information, and the standard Close button closes a modal view."*
- Rule for Portage: edge-swipe-to-go-back is an accelerant, never a substitute — a visible Back affordance must always be present in hierarchical (pushed) views.

**Modal vs. push navigation — CONFIRMED (modality.json + sheets.json):**
- Push/hierarchical navigation → Back button convention above.
- Modal presentation (sheet, full-screen modal, popover) is for "a distinct, narrowly scoped task" without losing the parent context; dismissal is a button (top toolbar in iOS) or swipe-down, and if closing would discard unsaved content, confirm first (e.g., an action sheet with a save option) — never silently discard.
- Only one sheet/modal visible at a time: "Display only one sheet at a time from the main interface... if something people do within a sheet results in another sheet appearing, close the first sheet before displaying the new one."
- Sheet-specific button placement rule: Cancel/Back on the leading edge, Done on the trailing edge; **never show Cancel, Done, and Back together**.

**Sheet detents — CONFIRMED (sheets.json), closes the prior UNVERIFIED gap:**
- System defines exactly two standard detents: **large** (fully expanded height) and **medium** (~half the fully expanded height); custom detent values are also supported.
- *"Sheets automatically support the large detent. Adding the medium detent allows the sheet to rest at both heights, whereas specifying only medium prevents the sheet from expanding to full height."*
- Use medium when progressive disclosure helps (a share sheet showing top items first); use large-only when the content needs full room immediately (Messages/Mail compose sheets never offer medium).
- A **grabber** (small horizontal drag indicator) signals resizability, supports drag-to-resize and tap-to-cycle between detents, and is VoiceOver-accessible.
- Swipe-to-dismiss is the expected gesture (not a dismiss button by default); iPadOS should prefer the page or form sheet presentation styles (centered content, dimmed background, default sizing) over ad hoc sizing.
Sources: https://developer.apple.com/design/human-interface-guidelines/navigation-and-search (structure only) · https://developer.apple.com/design/human-interface-guidelines/search-fields · https://developer.apple.com/design/human-interface-guidelines/gestures · https://developer.apple.com/design/human-interface-guidelines/toolbars · https://developer.apple.com/design/human-interface-guidelines/modality · https://developer.apple.com/design/human-interface-guidelines/sheets · https://developer.apple.com/design/human-interface-guidelines/path-controls (checked, not applicable)

### 7. Accessibility (layout-relevant)
Contrast: ≤17 pt text 4.5:1 minimum; ≥18 pt or bold 3:1. Reduce Motion: reduce automatic/repetitive animation — fades over transitions, gesture-tracked not automatic motion, no z-axis depth changes, no blur animation. Reduce Transparency / Increase Contrast alter Liquid Glass rendering.
Source: https://developer.apple.com/design/human-interface-guidelines/accessibility

### 8. Verdicts on the Portage shell as designed
- **Floating inset glass bottom bar:** VALIDATED — literally the iOS 26 default direction.
- **6 tabs + center circular Scan button:** CONTRADICTED on count (target ≤5) and the center FAB has no documented Apple pattern (closest idiom = accessory shelf above the bar) — keeping it is a deliberate deviation, not HIG-aligned.
- **Persistent floating Home chip on tab-bar-less pages:** NOT SUPPORTED by HIG — Apple's model is the tab bar itself, minimized but never fully absent, as the return path. Strengthened in follow-up: the confirmed Back-button rule (§6, gestures.json/toolbars.json) is Apple's actual return-path idiom for hierarchical views — "a Back button in a top toolbar... with a single tap" plus an optional edge-swipe accelerant — reinforcing that a bespoke floating chip has no HIG analog; the minimized tab bar (or a standard Back button, if the page is a pushed hierarchy rather than a tab root) is the aligned choice.
- **Collapsible sidebar (240px/72px):** direction VALIDATED (`sidebarAdaptable`, hide-to-reclaim-space endorsed); the px figures are Portage choices, not Apple numbers. Additionally validated by layout.json's independent "convertible tab bar" guidance (§2/§3).
- **Focus-expanding AI input in top bar:** still no exact HIG precedent for an expand-on-focus text input specifically, but follow-up found a closer analog than before: search-fields.json's placement rule ("place search at the bottom if there's room... top when deferring to bottom content") governs *any* primary text-entry field, not just literal search, and top-bar placement is the weaker of the two per that rule. Softened from pure UNVERIFIED to "no exact precedent, but the closest applicable rule favors bottom placement over top" — worth weighing against a top-bar Ask Porter input if a redesign is ever on the table.
- **Breakpoint-based iPad windowing adaptation (new verdict):** VALIDATED-WITH-NUANCE. multitasking.json confirms iPad windowed apps are freely resizable "with behavior similar to macOS" and that apps must "adapt gracefully to different screen sizes"; layout.json adds the behavioral mandate ("defer switching to compact view as long as possible," test at halves/thirds/quadrants). This validates that CSS-breakpoint responsiveness is a HIG-*compatible* implementation, but Apple's own mandate is continuous/behavior-based adaptation, not discrete breakpoints — don't cite HIG as prescribing breakpoints specifically, only as endorsing the resizable-window behavior breakpoints are approximating.

### 9. Verified in follow-up (JSON endpoints)

Method for this pass: `curl -s "https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json"`, then a Python walk of the JSON collecting every `{"type":"text","text":...}` node under `primaryContentSections` (this is the only reliable way to get body prose out of these pages — the HTML is a JS SPA shell). Endpoints fetched this session, all HTTP 200 unless noted:

| Endpoint | Result | Used for |
|---|---|---|
| `layout.json` | 25,108 chars extracted (was 4,200-char skim) | §2 convertible tab bar, §3 window-resize/adaptation guidance, safe-area/size-class device tables, confirmed absence of iOS/iPadOS margin numbers |
| `sheets.json` | 9,841 chars extracted (was 4,200-char skim) | §6 detents (large/medium), grabber, swipe-to-dismiss, Cancel/Done/Back placement rules |
| `multitasking.json` | 6,326 chars extracted (was 4,200-char skim) | §3/§8 iPad windowed-app resizing ("similar to macOS"), adapt-gracefully mandate |
| `navigation-and-search.json` | 11,237 bytes, but `primaryContentSections` is a bare link grid (`topicSectionsStyle: "hidden"`) | Confirmed this is an index/category page, not a content page — redirected research to its five child pages |
| `search-fields.json` | 200, 11,133 chars extracted | §6 search placement (tab / toolbar-top-or-bottom / inline), iPad/Mac sidebar-vs-toolbar placement |
| `path-controls.json` | 200, 1,323 chars extracted | Checked, confirmed **not applicable** — AppKit-only breadcrumb control, unsupported on iOS/iPadOS |
| `toolbars.json` | 200, 14,413 chars extracted | §6 Back vs Close semantics, toolbar zone rules (leading/center/trailing) |
| `navigation-bars.json` | **301 redirect** → `toolbars.json` | Confirmed navigation-bar guidance was merged into the toolbars page (per its own changelog, June 9 2025 entry: "incorporated navigation bar guidance") |
| `modality.json` | 200, 4,723 chars extracted | §6 modal-vs-push semantics, single-modal-at-a-time rule, unsaved-changes confirmation |
| `gestures.json` | 200, 13,863 chars extracted | §6 back-swipe-as-accelerant-not-replacement (the definitive back-swipe citation) |
| `the-app-icon.json` (negative control) | **404** | Sanity check that a genuinely nonexistent slug 404s distinctly from a redirect (301) or a hit (200) — confirms the technique reliably distinguishes "wrong slug" from "moved" from "found" |

**What changed:** every item flagged UNVERIFIED for detents, back-swipe, modal-vs-push, and search placement in the original doc is now backed by cited HIG body text. The only items still marked UNVERIFIED after this pass are (a) exact iOS/iPadOS numeric layout-margin values — confirmed genuinely absent from HIG prose, not a research gap — and (b) precedent for a focus-expanding AI input specifically (softened, see §8, but not resolved).

**Does any of this change the shell design decisions already made?** No hard reversals. One nuance worth flagging to Stephen: the breakpoint-based iPad approach is now confirmed HIG-*compatible* rather than HIG-*specified* — Apple's actual mandate is continuous, behavior-based adaptation ("defer collapse as long as possible," test at arbitrary/system sizes), which breakpoints approximate but don't literally implement. Everything else (5 tabs, Scan FAB as deliberate deviation, sidebar direction, minimized-bar-over-chip) stands as previously decided, now with stronger citations.

## Deltas applied / decided for Phase R0

1. Tab count ≤5 — decision Stephen (recommend: 5 tabs, More → avatar in page header).
2. Center Scan FAB — decision Stephen (recommend: keep as documented deliberate deviation).
3. Home chip vs minimized-bar pattern on tab-bar-less pages — decision Stephen (recommend: minimized bar, retire chip).
4. Adopt minimize-on-scroll for the mobile bar (fade-based under reduced motion).
5. Glass semantics: Regular-variant treatment for chrome only; never glass on content cards.
6. `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` as real render paths.
7. Touch targets: 44 pt default (28 pt absolute floor), 12/24 pt spacing rules in bar + icon-rail rows.
8. Native-port note: bottom-anchored primary search is the iOS 26 system-app convention — supports bottom-area Ask Porter placement. Now backed by cited HIG prose (§6/§9, search-fields.json: "Place search at the bottom if there's room... useful in any situation where search is a priority"), not just contemporaneous reporting.
