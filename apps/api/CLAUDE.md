# apps/api

Express 5 backend. See root CLAUDE.md for architecture overview.

## Middleware Chain (order matters)

1. `helmet()`
2. CORS — prod restricts to `portage.digitalharmonyai.com`; dev allows `10.0.0.251` variants
3. Billing webhook router (mounted **before** JSON parse — Stripe needs raw body)
4. `express.json({ limit: '10mb' })`
5. `pinoHttp()` — debug in dev, info in prod
6. Route handlers (21 routers)
7. `notFoundHandler`
8. `errorHandler` (must be last)

## Route Pattern

```typescript
// All routes export a named Router constant
export const itemsRouter = Router();

// Mounted in index.ts
app.use('/items', itemsRouter);
app.use('/marketplace/ebay', ebayAuthRouter);
```

Every route body: `try { ... } catch (err) { next(err) }`

## Error Handling

Custom `AppError` class in `src/middleware/error.ts`:

```typescript
throw new AppError(401, 'UNAUTHORIZED', 'Invalid token');
// → { error: "Invalid token", code: "UNAUTHORIZED" }
```

Zod validation errors auto-caught and returned as 400 with details array.

## Auth Middleware

Three guards in `src/middleware/auth.ts`:

| Guard | Checks | Failure |
|-------|--------|---------|
| `requireAuth` | Valid JWT Bearer token | 401 |
| `requireAdmin` | `req.user.role === 'admin'` | 403 ADMIN_REQUIRED |
| `requirePro` | `req.user.tier === 'pro'` | 403 PRO_REQUIRED |

`req.user` shape: `{ sub: string, email: string, tier: 'free'|'pro', role: 'user'|'admin' }`

## Database Access

Lazy-initialized proxy in `src/db/index.ts` — connects on first query, not at import.

```typescript
import { db } from '../db/index.js';
import { items } from '../db/schema.js';

await db.select().from(items).where(eq(items.userId, userId));
```

## Marketplace Token Encryption

OAuth refresh tokens stored AES-256-GCM encrypted. Key derived from `ENCRYPTION_KEY` (decoupled from JWT_SECRET). Token format: `${iv}:${authTag}:${encrypted}` (hex). Decryption handled in `src/marketplace/token-manager.ts`.

Access tokens refreshed **5 minutes before expiry** to avoid race conditions. eBay app tokens cached in-memory with pending-request dedup.

## Input Validation

All route inputs validated with Zod schemas. Search queries escape `%` and `_` for ILIKE to prevent SQL injection.

## HTTPS in Production

Reads SSL certs from `../../../certs/`. Falls back to HTTP in dev. Exits with error code 1 if certs missing in production.

## Route Files

| Route | Path | Auth |
|-------|------|------|
| Health | `/health` | None |
| Auth | `/auth/*` | None |
| Items | `/items` | requireAuth |
| Images | `/images` | requireAuth |
| Listings | `/listings` | requireAuth |
| Orders | `/orders` | requireAuth |
| Scan | `/scan` | requireAuth |
| Porter | `/porter` | requireAuth |
| Drafts | `/drafts` | requireAuth |
| Shipping | `/shipping` | requireAuth |
| Prepare listing | `/items` (sub-mount) | requireAuth |
| Seller profile | `/seller-profile` | requireAuth |
| Preferences | `/users/me/preferences` | requireAuth |
| Usage | `/usage` | requireAuth |
| Survey | `/survey` | None |
| Billing | `/billing` | requireAuth |
| Admin | `/admin/*` | requireAdmin |
| Marketplace OAuth | `/marketplace/{ebay,etsy}` | requireAuth |
| Reverb Auth | `/marketplace/reverb` | requireAuth |
| Dashboard | `/dashboard` | requireAuth |

## Testing

Vitest. Run `npm test` (once) or `npm run test:watch`. ~200 tests across 20 files covering crypto, JWT, auth, admin, routes, vision, scan, billing, and eBay CSV export.
