---
title: Ship Log
sidebar_label: Ship Log
sidebar_position: 0
---

# Ship Log

Structured records of every `/ship` workflow run for **portage**.
Total: **38** sessions.

| # | Feature | Status | PR | Deferred |
|---|---------|--------|----|----------|
| 1 | [Critical code health fixes — ILIKE escape, AI tool loop cap,](001-critical-code-health-fixes-ilike-escape-ai-tool-loop-cap-stu) | complete | — | 0 |
| 2 | [JWT auto-refresh — intercept 401, auto-refresh with stored r](002-jwt-auto-refresh-intercept-401-auto-refresh-with-stored-refr) | complete | [#32](https://github.com/sdnydude/portage/pull/32) | 0 |
| 3 | [Scan/lookup pipeline accuracy bugs — eBay condition normaliz](003-scan-lookup-pipeline-accuracy-bugs-ebay-condition-normalizat) | complete | [#26](https://github.com/sdnydude/portage/pull/26) | 4 |
| 4 | [Listings CRUD — edit/update/delete from UI with marketplace ](004-listings-crud-edit-update-delete-from-ui-with-marketplace-sy) | complete | [#27](https://github.com/sdnydude/portage/pull/27) | 5 |
| 5 | [C1 — Fix order sync assigns wrong listing to incoming orders](005-c1-fix-order-sync-assigns-wrong-listing-to-incoming-orders) | complete | [#28](https://github.com/sdnydude/portage/pull/28) | 5 |
| 6 | [C2 — Fix XSS via dangerouslySetInnerHTML with unsanitized AI](006-c2-fix-xss-via-dangerouslysetinnerhtml-with-unsanitized-ai-t) | complete | [#29](https://github.com/sdnydude/portage/pull/29) | 0 |
| 7 | [C3 — Replace sql.raw() with parameterized Drizzle APIs to pr](007-c3-replace-sql-raw-with-parameterized-drizzle-apis-to-preven) | complete | [#30](https://github.com/sdnydude/portage/pull/30) | 0 |
| 8 | [C4 — Decouple encryption key from JWT_SECRET](008-c4-decouple-encryption-key-from-jwt-secret) | complete | [#31](https://github.com/sdnydude/portage/pull/31) | 0 |
| 9 | [Fix Object URL memory leaks in listing flows](009-fix-object-url-memory-leaks-in-listing-flows) | complete | [#33](https://github.com/sdnydude/portage/pull/33) | 0 |
| 10 | [Test infrastructure — vitest config, env setup, JWT helpers](010-test-infrastructure-vitest-config-env-setup-jwt-helpers) | complete | [#34](https://github.com/sdnydude/portage/pull/34) | 0 |
| 11 | [P0 tests — crypto, jwt, password, auth middleware, error han](011-p0-tests-crypto-jwt-password-auth-middleware-error-handler-2) | complete | [#35](https://github.com/sdnydude/portage/pull/35) | 0 |
| 12 | [P0 route tests — auth endpoints + computePricing via createA](012-p0-route-tests-auth-endpoints-computepricing-via-createapp-f) | complete | [#36](https://github.com/sdnydude/portage/pull/36) | 0 |
| 13 | [Docker environment fixes — API crash, background removal, we](013-docker-environment-fixes-api-crash-background-removal-web-co) | complete | [#51](https://github.com/sdnydude/portage/pull/51) | 0 |
| 14 | [Unified photo capture + editing flow with multi-photo scan, ](014-unified-photo-capture-editing-flow-with-multi-photo-scan-inl) | complete | [#52](https://github.com/sdnydude/portage/pull/52) | 3 |
| 15 | [Fix Dependabot vulnerabilities + clean up website/ tooling](015-fix-dependabot-vulnerabilities-clean-up-website-tooling) | complete | — | 0 |
| 16 | [Ship session intelligence pipeline + unified KB search](016-ship-session-intelligence-pipeline-unified-kb-search) | complete | — | 5 |
| 17 | [Memory intelligence Loops 2+3 activated end-to-end](017-memory-intelligence-loops-2-3-activated-end-to-end) | complete | — | 5 |
| 18 | [Loop 4 self-training (Minimal) — corrections capture + brief](018-loop-4-self-training-minimal-corrections-capture-briefing-su) | complete | — | 6 |
| 19 | [WebP to JPEG image format — fix marketplace compatibility](019-webp-to-jpeg-image-format-fix-marketplace-compatibility) | complete | [#63](https://github.com/sdnydude/portage/pull/63) | 5 |
| 20 | [Registry KB acceleration — bulk ingest memory + CLAUDE.md fi](020-registry-kb-acceleration-bulk-ingest-memory-claude-md-files) | complete | [#64](https://github.com/sdnydude/portage/pull/64) | 4 |
| 21 | [Registry upsert/idempotency for all non-idempotent tables + ](021-registry-upsert-idempotency-for-all-non-idempotent-tables-de) | complete | [#18](https://github.com/sdnydude/dhgaifactory3.5/pull/18) | 4 |
| 22 | [Code health week 1 — resolve 30 Important + 20 Minor finding](022-code-health-week-1-resolve-30-important-20-minor-findings) | complete | [#65](https://github.com/sdnydude/portage/pull/65) | 5 |
| 23 | [Deferred items from code health review](023-deferred-items-from-code-health-review) | complete | [#66](https://github.com/sdnydude/portage/pull/66) | 0 |
| 24 | [Full codebase code health review — 37 findings](024-full-codebase-code-health-review-37-findings) | complete | [#65](https://github.com/sdnydude/portage/pull/65) | 4 |
| 25 | [audit-test](025-audit-test) | complete | — | 0 |
| 26 | [automation-test](026-automation-test) | complete | — | 0 |
| 27 | [Full wiring and deployment audit of memory/registry pipeline](027-full-wiring-and-deployment-audit-of-memory-registry-pipeline) | complete | [#67](https://github.com/sdnydude/portage/pull/67) | 3 |
| 28 | [Hook-driven capture — guaranteed registry ingest via session](028-hook-driven-capture-guaranteed-registry-ingest-via-session-h) | complete | [#68](https://github.com/sdnydude/portage/pull/68) | 3 |
| 29 | [Capture-guarantee V2 — decisions + deferred auto-fire, advis](029-capture-guarantee-v2-decisions-deferred-auto-fire-advisory-l) | complete | [#69](https://github.com/sdnydude/portage/pull/69) | 3 |
| 30 | [Capture-guarantee V3 — corrections + bug-fixes auto-fire wit](030-capture-guarantee-v3-corrections-bug-fixes-auto-fire-with-co) | complete | [#70](https://github.com/sdnydude/portage/pull/70) | 0 |
| 31 | [Fix all 4 feedback loops — cron, journal aging, correction/b](031-fix-all-4-feedback-loops-cron-journal-aging-correction-bug-f) | complete | [#71](https://github.com/sdnydude/portage/pull/71) | 2 |
| 32 | [Stripe subscription billing — Pro tier, trials, credit packs](032-stripe-subscription-billing-pro-tier-trials-credit-packs) | complete | [#73](https://github.com/sdnydude/portage/pull/73) | 4 |
| 33 | [Billing enforcement gates — marketplace count + bg-removal](033-billing-enforcement-gates-marketplace-count-bg-removal) | complete | [#74](https://github.com/sdnydude/portage/pull/74) | 0 |
| 34 | [Billing enforcement gaps — marketplace count limit + backgro](034-billing-enforcement-gaps-marketplace-count-limit-background-) | complete | [#74](https://github.com/sdnydude/portage/pull/74) | 0 |
| 35 | [Reverb token-paste auth flow](035-reverb-token-paste-auth-flow) | complete | [#75](https://github.com/sdnydude/portage/pull/75) | 2 |
| 36 | [eBay Seller Hub Reports CSV export with marketplace data cac](036-ebay-seller-hub-reports-csv-export-with-marketplace-data-cac) | complete | [#76](https://github.com/sdnydude/portage/pull/76) | 5 |
| 37 | [scan comp cards + reverb UI + features doc + docs tunnel](037-scan-comp-cards-reverb-ui-features-doc-docs-tunnel) | complete | [#79](https://github.com/sdnydude/portage/pull/78, https://github.com/sdnydude/portage/pull/79) | 0 |
| 38 | [eBay buyer messaging — read inbox + reply via Trading API](038-ebay-buyer-messaging-read-inbox-reply-via-trading-api) | complete | [#84](https://github.com/sdnydude/portage/pull/84) | 3 |
