# Handoff

## State
31/46 tasks complete. Full admin panel shipped (Tasks 36-46): DB schema (role, audit_log, app_settings), JWT role + requireAdmin middleware, 17 admin API endpoints in `apps/api/src/routes/admin.ts`, 9 frontend pages under `apps/web/src/app/admin/` (dashboard, users, user detail, inventory, listings, orders, porter, marketplace, settings, audit). All TypeScript compiles clean. All 9 admin pages return 200. Promote script at `apps/api/src/scripts/promote-admin.ts`.

## Next
1. Browser-test the admin panel end-to-end (promote demo user, verify dashboard stats, user management actions, settings toggles)
2. Task 29: PWA service worker + installability (manifest done, icons + SW remaining)
3. Remaining: 21 (shipping), 23 (Stripe), 26 (notifications), 27 (dashboard), 28 (onboarding), 30-32 (bulk/messaging/settings), 34-35 (production/testing)

## Context
- All URLs use 10.0.0.251 not localhost
- Next.js dev: `WATCHPACK_POLLING=true next dev --port 3002 --hostname 0.0.0.0 --webpack`
- next.config.ts: `allowedDevOrigins: ["10.0.0.251"]` + webpack watchOptions polling
- Admin access: role column on users table, email-based promotion via `npx tsx apps/api/src/scripts/promote-admin.ts <email>`
- Admin audit trail: every mutation logged to admin_audit_log with before/after details
- App settings: key-value table for runtime config (tier limits, feature flags)
- Demo user: demo@portage.app / demo1234demo1234 (5 items)
