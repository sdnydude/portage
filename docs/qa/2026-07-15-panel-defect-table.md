# Panel Defect Table — third-pass review (2026-07-15)

Stephen flagged 5 artifacts as "a mess" (third round). One row per item; the
authoritative copy WITH embedded photos and his verdict column is
`2026-07-15-panel-defect-table.xlsx` in this directory. NOTHING in this table
is fixed until Stephen approves the row.

| # | Item | Defects found | Root cause | Proposed fix | Verdict |
|---|------|--------------|------------|--------------|---------|
| 1 | Item-detail panel (XVIVE, adding-items step 3) | Ring border on title/description glyphs; ring bottom bisects description; QUANTITY/FEATURES text under floating tab bar in-screenshot; header title truncates | Edge-to-edge ring coords, no clearance rule; capture ignores under-bar content | Overlay rule (≥2% clearance, snap to elements); recapture pinned-scroll or ring photos block only | pending |
| 2 | Frame top, create-listing 3× asset | Bezel+radius enormous at 3× (compact was fixed, full-size wasn't); content pinched at edges; callout oversized | One chrome spec exported close-up without re-judging | Slim asset chrome (~4px/24px); drop callout/tap overlays from frame-only exports | pending |
| 3 | Frame bottom (same source as 2) | Double-chrome stack (in-app bar → gap → fat bezel); corner wedges | Same bezel scale + product bar duplicating device chrome | Bezel slimming; optionally crop frame-only assets above the in-app bar | pending |
| 4 | Inventory browse ring | Ring overlaps "All" chip; slices filter row; ring bottom cuts card row mid-photo; SEPARATE app bug: "Furn…" chip truncated by count+toggles at 390px | Region-eyeballed ring; genuine filter-row crowding defect | Snap ring to two full rows; file filter-row crowding as app bug | pending |
| 5 | Hub setup-step1.png (sign-off drop) | STALE artifact: his-account capture (Connected usernames + Disconnect vs "Tap Connect" copy, PII); callout covers Reverb row; ring clips card subtext | Process failure: drop published then superseded without regeneration | Mandatory hub re-drop at end of every render cycle; stale drops pruned | pending |
| S1 | Systemic: overlay geometry | Rings overlap glyphs / bisect elements across panels | No clearance/snap rule | Codify ≥2% inset + element snapping; re-verify all 24 | pending |
| S2 | Systemic: frame chrome at asset scale | In-app chrome wrong for 3× close-ups | One spec, two display sizes | Dedicated slim export chrome (or slim everywhere — Stephen's look call) | pending |
| S3 | Systemic: captured-page hygiene | Text under in-app bar; double-chrome | Natural-scroll captures with floating bar | Pinned scroll, no text under bar; crop frame-only above bar | pending |
| S4 | Systemic: review-hub freshness | Stephen reviewed superseded material | Drops not regenerated after changes | Regenerate drop as last step of every render cycle | pending |
