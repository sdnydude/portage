# Langfuse in Portage → self-host pivot

**Span:** 2026-07-19 evening → 2026-07-20 early morning (ET)
**Arc:** Installed the Langfuse skill and added LLM tracing to Portage; fixed a real save bug found along the way; then a strategy conversation reframed the whole effort into self-hosting Langfuse in the AI Factory and migrating off LangSmith.

## What shipped in Portage

Installed the Langfuse skill (`github.com/langfuse/skills`) and instrumented every LLM path in `apps/api`: `scan-item`, `scan-refine`, `porter-chat-turn` (stream + non-stream), `prepare-listing`. OTel-based (`@langfuse/otel` + `@langfuse/tracing` + `observeOpenAI`), booted from `apps/api/src/instrumentation.ts` before any other import. Request context (userId/sessionId/tags) rides OTel context via `propagateAttributes`, so no lib signature changed. Porter tool calls became typed `tool` observations; Porter conversation id = sessionId. Image payloads masked out. All on branch `feat/langfuse-tracing` (2 commits), deployed to prod against **Langfuse Cloud US**, verified live (per-user cost/tokens landing).

## The bug the audit caught (unrelated, ship it)

`fix(api)` df272d0: saving a scanned item 400'd with an opaque "Validation failed." Root cause — `createItemSchema` capped `conditionNotes` at 500 while the vision layer parsed it with no max, so the scan pipeline emitted a value its own API rejected. Cap raised to 2000 (matching `description`) + clamp in `vision.ts`. Identified by matching the 400's byte length against candidates. Live-proven. **Cherry-pick to `main` independently — it's a real save-bug fix unrelated to observability.**

## The pivot

A strategy conversation untangled a three-layer conflation: **LangGraph** = orchestration, **LangSmith** = observability, **Langfuse** = the LangSmith replacement (NOT an orchestrator). Decision: **self-host Langfuse in the AI Factory** (infra already present), re-point Portage to it, and migrate the factory's LangGraph agents from LangSmith to Langfuse via `CallbackHandler`. User-level observability (email as user id) becomes safe once self-hosted. Full handoff written to `~/DHG/aifactory3.5/LANGFUSE_SELFHOST_HANDOFF.md`; work continues in a new aifactory session starting with the brainstorming superpower.

## Learnings

- Langfuse JS has two silent-drop traps: the default export filter allowlists scope prefix `openinference.*` but the OpenInference Anthropic package reports `@arizeai/openinference-instrumentation-anthropic` (every Anthropic generation dropped); and the processor `mask` only covers `langfuse.*` attributes, so third-party instrumentation leaks unmasked. Both invisible without fetching a live trace back and auditing it.
- "Add tracing" is not done when it compiles or when traces appear — it's done when you fetch the trace and audit its structure. Three defects only surfaced that way.
- A near-match term is not a confirmation: "langraph" was LangGraph, not Langfuse. Don't autocorrect an ambiguous term to the in-context system.

## Insights

- Langfuse replaces LangSmith, never LangGraph — wrong-layer substitution ("does Langfuse have a LangGraph-type orchestrator?" → no, and it never will). Observability ≠ orchestration.
- Self-hosting Langfuse removes the PII-to-third-party concern that gates user-level observability; hosting model should be decided before attaching identity.

## Deferred

- Self-host Langfuse in aifactory (Postgres/ClickHouse/Redis/object store) — the new session's work.
- Migrate factory LangGraph agents LangSmith → Langfuse (`CallbackHandler`).
- Replace LangGraph as orchestrator (local, cheaper, simpler) — candidates Pydantic AI / LlamaIndex Workflows; spike one graph first. Separate track.
- Cherry-pick df272d0 (conditionNotes) to Portage `main`.
- Decide merge/hold of `feat/langfuse-tracing`.
- Rename `feedback_no_selfhosted_secrets` memory so its scope correction can be written (no-secrets hook blocks the current filename).
