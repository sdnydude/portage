# Session report — P5 log-program build + P7 paper-cuts (2026-08-25 → 08-26)

Two full ship arcs and a live prod incident, across two repos. Eight PRs
merged: portage #323–#329 (spec docs through ship-log 137) and
dhgaifactory3.5 #27.

## Arc 1 — P5 build (T1–T13)

The operator reframed mid-plan: "treat Loki as new to us" — so instead of
patching the 2.9/promtail config, the build became a proper foundation:
Loki 3.7.6 with an additive dual schema (boltdb v11 kept readable, tsdb/v13
from the UTC cutover), keep-all made explicit (`retention_period: 0`,
compactor without retention), promtail (EOL 2026-03-02) replaced by Alloy
with ingest redaction, and the ruler switched to Alertmanager's v2 API.

The operator's wiring-review mandate paid for itself twice. The integration
verifier found the production alert path had been dark the whole time —
Alertmanager v0.27 removed the v1 API, so every ruler notification had
410'd (13,652 dropped) while the rules evaluated green. And the seeded-secret
proof caught that Alloy's `stage.replace` inverts promtail semantics: it
replaces the capture group with the literal string, no `${1}` expansion,
groupless patterns are no-ops — all six redaction stages had shipped broken
and syntax checks could never have caught it.

Other live catches: a River-escaping crash-loop (validate gate now
load-bearing), Loki 3.x auto-adding `service_name` (label-parity gate),
the `fake` tenant change for auth-off rulers, a registry crash-loop from an
async-generator `return` (3 minutes of prod downtime, caught and fixed),
LogStream's follow-scroll yanking the page (found by actually LOOKING at
the proof screenshot), and grounding false-positives on container names
the model had faithfully quoted from context.

All three new alerts were live-fire drilled to registry incidents and
closed out. The cross-boundary retention proof ran post-cutover: both
schema periods queryable, zero tsdb/index errors. B9's /logs panel was
browser-proven (0.8 s answer with citations chips and a sampled-lines
terminal panel on the app's mc-* tokens).

## Arc 2 — prod incident, mid-P7

A live "Internal server error" on Create Listing turned out to be eBay
policy error 240 (`LP_Miscat_Accessories_in_Tablet`): the title named an
accessory ("Free Apple iPad case included") on a tablet listing. Diagnosed
in minutes from the now-redacted logs. The real defect was ours though —
eBay's actionable guidance had collapsed into a generic 500. Fixed same
night: `EbayTradingError` → 422 `EBAY_REJECTED` with eBay's message,
deployed to the live container.

## Arc 3 — P7 paper-cuts (14/14)

A pre-build advisor validated the 10-day-old §P7 table against current main
first: 13 BUILD (with corrected line refs — one had drifted 19 lines, one
not at all) and 1 respec (Ubuntu's apt gh is 2.45; the official repo was
needed). Then tdd-guard rhythm, one commit per item. Notables: the
publish-fallback warning bug was live and silent; `ebayTaxonomyCalls` had
zero callers so its label reshape was free (a route-level caller codegraph
missed joined the shape in #328); the tdd-guard contention item became a
documented serialized-suite constraint (ruling A) because the validator
hard-codes its data dir.

## Learnings

- An alert rule that evaluates is not an alert path that delivers — verify
  delivery lands at the receiver, not rule health.
- Seeded proofs are the only real gate for redaction: two different
  config-transcription bugs passed syntax checks and died on the proof.
- `gh pr checks --watch | tail` eats the exit code; a suite failure rode
  a green chain for hours. Count non-pass rows or read mergeStateStatus.
- Run vitest from the workspace dir — tdd-guard's reporter never flushes
  under repo-root `--root` invocation, and the validator then judges edits
  against a stale run.
- codegraph caller lookups can miss route-level callers — verify metric/
  signature reshapes with a text-level sweep too.

## Insights

- Alloy `stage.replace` semantics (capture-group/literal) — registry 5d016752.
- Ruler→AM v2 black hole — registry bd752a8f.
- Ephemeral gh checks: after `update-branch`, required checks reset and the
  PR sits BLOCKED until the new head reports; merge attempts race a
  freshness check.

## Deferred

None. P6 + P8 remain as planned program phases, not deferrals.
