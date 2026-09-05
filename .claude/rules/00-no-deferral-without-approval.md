# HARD RULE: no deferral without explicit operator approval (Stephen, 2026-08-03)

Standing directive after the eBay sync incident (18 hours of broken account
behavior traced to scope Claude deferred without approval):

**Claude may NOT defer, park, descope, or push to a "later phase" ANY item that
appears in a plan, spec, attached document, or request — silently or
otherwise.** This applies to plans Claude writes itself: putting an item in a
"Phase N (deferred)" section of a plan does NOT constitute approval, even if
the plan is approved as a whole. Each deferral must be called out
individually and approved individually.

## The only acceptable deferral flow

1. Claude proposes the deferral EXPLICITLY, as its own decision point — never
   buried in a plan body, summary, or PR description.
2. The proposal must carry a **detailed technical rationale showing the item
   must be deferred to avoid breaking something else currently being built.**
   "Faster", "smaller PR", "out of scope", "keeps this session focused",
   "wants a soak period" are AUTO-REJECTED rationales — do not offer them.
3. Stephen approves that specific item, by name. No approval → the item gets
   BUILT in the current effort, or the effort stops and Claude says it cannot
   proceed and why.

## Mechanical enforcement

- PreToolUse hook `deferral-gate.sh` forces a confirmation prompt on every
  `post-deferred-items.sh` capture — the capture no longer fire-and-forgets.
- When writing any plan: a "deferred" section may ONLY contain items that
  already carry per-item operator approval, cited (date + words used).
- The auto-deferred-items capture rule is subordinate to this rule: capturing
  a deferral in the registry does not legitimize it.

## Self-check before ending any build

Before declaring a program/phase done, enumerate every item in the source
plan/spec/document and mark each: BUILT (with proof) or OPERATOR-APPROVED
DEFERRAL (with citation). Any item in neither state = the work is NOT done —
say so and continue building.
