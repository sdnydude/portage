# 2026-08-29 — P8 closed, Cloudflare truth, session_reports KB source, git-risk-gate advisor review

**Span:** 2026-08-28 evening → 2026-08-29 late evening. **Model:** claude-fable-5.

## Story

The session opened on "what's next" with P8 (deferral settle pass) paused mid-evidence. All seven P8 checks were run live: item `bbaddd00` moot (unlisted, eBay listing archived, categoryId stored); docs domain already public; the dhg-docs nginx port-dropping 301 reproduced and fixed with `absolute_redirect off;` (a container **restart** was required — the Edit tool's inode swap under a bind mount meant `nginx -s reload` read the old file); agentlint 2.5.3 no longer over-fires on plain pushes; the PreToolUse hook chain measured at ~140 ms per Bash call (not the multi-minute latency source); the docs-audit worklist closed with 14 remaining unreferenced verification PNGs removed.

The R2 CORS pair stalled for over an hour on credentials. Root cause, found by reading memory, the registry decision log and the 06-06 `cloudflare-ops` spec: the scope-C decision (one broad write token + `cloudflare/mcp`) was only half-built; the working `CF_API_TOKEN` had Access scope but no R2; a second token in `dhg-infra/dev` had been mislabelled "dead" because it is an **account** token that 401s on `/user/tokens/verify` — it actually holds `Account API Tokens Write`. That token minted `claude-cloudflare-ops` (scope C) via the API; stored as `CF_OPS_TOKEN`; CORS applied and live-verified on a real object. A single-source-of-truth memory (`reference_cloudflare_capability_truth.md`) now lives in both project memory dirs.

P8 shipped as PR #343; #341/#342 merged; `session_reports` became a KB search source (aifactory PR #28, live) with the portage rule updated (#344).

The git-risk-gate Portage integration /ship then started and was stopped at Phase 3 after the operator challenged hook wiring, the tripwire and the missing dashboard. A three-advisor review (architect, security, adversarial) confirmed the concerns and found a tool defect: simulating the draft config over the last 22 real commits gave a **100 % ask-rate** because `opaque_command` matches every `-m "$(cat <<'EOF'…)"` commit by substring, and `gh pr create` is re-gated. The operator's final direction: ships 2–4 must live inside the git-risk-gate repo so the first OSS release runs standalone; the work moves to a session opened in that repo.

## Learnings
- Account-scoped Cloudflare tokens fail `/user/tokens/verify`; verify them at `/accounts/{id}/tokens/verify` before calling them dead.
- Editing a bind-mounted config with the Edit tool replaces the inode; the container keeps the old file until restart.
- A spec that pins product features of an OSS tool to private infra is improvisation, not design — the first release must run with the package alone.
- Polls belong in the background; a question that does not gate the next phase must not stop the work.

## Insights
- The Cloudflare "we argue every time" loop was three project memory dirs holding three different capability beliefs; one cross-project truth file ends it.
- git-risk-gate's opacity trigger cannot tell evasion (`git` inside `$(…)`) from a heredoc used as a quoted `-m` argument; on Claude Code's house style that is a 100 % false-positive rate.

## Deferred
- None approved. Open direction (operator): git-risk-gate spec §1 rewrite + opacity fix in the tool's own repo; then website launch + Portage beta landing/sign-up.
