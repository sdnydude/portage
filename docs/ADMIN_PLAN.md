# Portage Admin Panel — Comprehensive Plan

**Goal:** A full-featured admin panel usable by non-technical team members. No terminal, no SQL, no jargon. Think Shopify admin or Stripe dashboard — everything is point-and-click with clear labels, search, filters, and confirmations.

---

## 1. Access Control

### Who gets in
An `admin` email allowlist, checked at login. No self-registration for admin access.

### Database changes
```
users table:
  + role: varchar ('user' | 'admin')  — default 'user'
  + disabled_at: timestamp nullable   — soft-disable accounts
  + disabled_reason: text nullable     — why (visible to admin)

New table: admin_audit_log
  id: uuid PK
  admin_user_id: uuid FK → users
  action: varchar          — e.g. 'disable_user', 'change_role', 'change_tier'
  target_type: varchar     — 'user', 'item', 'listing', 'order', 'setting'
  target_id: uuid
  details: jsonb           — before/after values
  created_at: timestamp

New table: app_settings
  key: varchar PK          — e.g. 'free_tier_scan_limit', 'maintenance_mode'
  value: jsonb
  updated_by: uuid FK → users
  updated_at: timestamp
```

### Auth flow
- JWT gains a `role` field: `{ sub, email, tier, role }`
- New middleware: `requireAdmin` — checks `req.user.role === 'admin'`
- All `/admin/*` API routes use `requireAuth` + `requireAdmin`
- Frontend: Next.js middleware redirects non-admins away from `/admin/*`
- **Seed command:** `npm run admin:seed -- --email you@example.com` promotes an existing user to admin

---

## 2. Route Structure

```
/admin                        → Dashboard (KPI overview)
/admin/users                  → User management
/admin/users/[id]             → User detail (their items, listings, usage)
/admin/inventory              → All items across all users
/admin/listings               → All listings across all users
/admin/orders                 → All orders across all users
/admin/porter                 → AI usage & conversation browser
/admin/marketplace            → Marketplace connection health
/admin/settings               → App config (tier limits, feature flags)
/admin/audit                  → Audit log (who did what)
```

### Layout
- **No bottom tab bar** — admin lives outside the `(tabs)` route group
- **Sidebar navigation** on the left (collapsible on mobile)
- **Top bar** with admin user info, "Back to App" link, and search
- **Responsive** — works on desktop and tablet, functional on phone

---

## 3. Pages in Detail

### 3.1 Dashboard (`/admin`)

The first thing the team sees. Answers: "How is the app doing right now?"

**Top row — 6 metric cards:**
| Card | Source | What it shows |
|------|--------|---------------|
| Total Users | `COUNT(users)` | Number + trend arrow (vs last week) |
| Active Today | `COUNT(users WHERE last_active > today)` | Users who logged in today |
| Total Items | `COUNT(items)` | Inventory pieces across all users |
| Active Listings | `COUNT(listings WHERE status='active')` | Live on marketplaces |
| Orders This Month | `COUNT(orders WHERE sold_at > month_start)` | Sales volume |
| Revenue This Month | `SUM(orders.sale_price WHERE sold_at > month_start)` | Dollar total |

**Charts (simple, clear):**
- **Signups over time** — bar chart, last 30 days
- **Items added per day** — line chart, last 30 days
- **Sales by marketplace** — pie chart (eBay vs Etsy)
- **AI scan usage** — bar chart showing scans used vs available

**Recent activity feed:**
- Last 10 events: "Jane listed Nikon F3 on eBay for $399", "Bob signed up", "Order #XYZ shipped"
- Each row is clickable → navigates to the relevant detail page

---

### 3.2 User Management (`/admin/users`)

**List view:**
| Column | Content |
|--------|---------|
| User | Email + display name |
| Role | `user` / `admin` badge |
| Plan | `free` / `pro` badge (color-coded) |
| Items | Count of their items |
| Listings | Count of active listings |
| Revenue | Total sales $ |
| AI Usage | Scans used / limit this month |
| Joined | Date |
| Status | Active / Disabled |

**Features:**
- Search by email or display name
- Filter by: plan (free/pro), role (user/admin), status (active/disabled)
- Sort by any column
- Bulk select → bulk actions: change tier, disable, export CSV
- Click row → user detail page

**Actions (per user):**
| Action | What it does | Confirmation? |
|--------|-------------|---------------|
| Change Plan | Toggle free ↔ pro | Yes — "Change Jane to Pro plan?" |
| Make Admin | Set role to admin | Yes — "Grant admin access to Jane?" |
| Remove Admin | Set role to user | Yes — "Remove admin access from Jane?" |
| Disable Account | Soft-disable (sets disabled_at + reason) | Yes — with reason text field |
| Enable Account | Clears disabled_at | Yes |
| Reset Usage | Zero out AI scans + bg removals | Yes |
| Delete Account | Hard delete (cascade) | Double confirm — type email to confirm |

---

### 3.3 User Detail (`/admin/users/[id]`)

Everything about one user, on one page. Tabs:

**Overview tab:**
- Profile card: email, display name, plan, role, joined date, last active
- Usage gauges: AI scans (12/25), BG removals (3/5) — visual bars
- Marketplace connections: eBay connected ✓ / Etsy not connected ✗
- Action buttons: Change Plan, Disable, Reset Usage

**Items tab:**
- Grid/list of all their items with photos, titles, values
- Click → opens item in admin inventory view

**Listings tab:**
- All their listings with status, marketplace, price
- Click → opens listing in admin listings view

**Orders tab:**
- Their order history

**Porter tab:**
- Their AI conversations (read-only browse)
- Message count, last conversation date

**Audit tab:**
- Admin actions taken on this user (from audit log)

---

### 3.4 All Inventory (`/admin/inventory`)

Browse every item in the system. For content moderation and support.

**List view:**
| Column | Content |
|--------|---------|
| Photo | Thumbnail |
| Title | Item name |
| Owner | User email (link to user detail) |
| Category | Category label |
| Condition | Badge |
| Est. Value | Min–Max range |
| AI Confidence | Score (color-coded: green >0.8, yellow >0.5, red <0.5) |
| Created | Date |

**Features:**
- Search by title, brand, model
- Filter by: category, condition, value range, owner, date range
- Sort by any column
- Click row → item detail (read-only, with link to user context)

---

### 3.5 All Listings (`/admin/listings`)

**List view:**
| Column | Content |
|--------|---------|
| Item | Title + thumbnail |
| Seller | User email |
| Marketplace | eBay / Etsy badge |
| Status | Draft / Active / Sold / Archived (color-coded) |
| Price | Listed price |
| Created | Date |
| Published | Date (or "—" for drafts) |

**Features:**
- Filter by: marketplace, status, seller, date range, price range
- Search by item title
- Export to CSV

---

### 3.6 All Orders (`/admin/orders`)

**List view:**
| Column | Content |
|--------|---------|
| Order ID | Marketplace order ID |
| Item | Title + thumbnail |
| Seller | User email |
| Buyer | Username |
| Marketplace | Badge |
| Sale Price | $ |
| Fees | Marketplace fees |
| Net | Sale - fees - shipping |
| Status | Payment Received / Label Purchased / Shipped / Delivered |
| Sold | Date |

**Features:**
- Filter by: status, marketplace, seller, date range
- Search by order ID, item title, buyer name
- **Revenue summary bar** at top: total sales, total fees, total net

---

### 3.7 Porter AI (`/admin/porter`)

Monitor AI usage and costs. Non-technical view.

**Overview:**
- Total conversations (all time + this month)
- Total messages sent (all time + this month)
- Messages per user (average)
- Estimated API cost this month (messages × avg cost)

**Conversation browser:**
- List of all conversations: user, message count, date, first message preview
- Click → read-only conversation view (message bubbles, same as user sees)
- Search across all conversations by content

**Usage by user:**
- Table: user, conversations, messages, last conversation
- Sorted by most active

---

### 3.8 Marketplace Health (`/admin/marketplace`)

Quick view of all marketplace connections across users.

**Connection table:**
| User | Marketplace | Connected Since | Token Expires | Status |
|------|------------|-----------------|---------------|--------|
| jane@... | eBay | Mar 15 | Jun 15 | ✓ Healthy |
| jane@... | Etsy | Apr 1 | Apr 30 | ⚠ Expiring Soon |
| bob@... | eBay | Feb 10 | — | ✗ Expired |

**Summary cards:**
- Total eBay connections / healthy / expiring / expired
- Total Etsy connections / healthy / expiring / expired

**Alerts:**
- Tokens expiring within 7 days (amber)
- Tokens already expired (red)

---

### 3.9 App Settings (`/admin/settings`)

Editable configuration — no code needed.

**Tier Limits section:**
| Setting | Current | Edit |
|---------|---------|------|
| Free Tier: AI Scans / Month | 25 | ✏️ |
| Free Tier: BG Removals / Month | 5 | ✏️ |
| Free Tier: Marketplaces | 1 | ✏️ |
| Free Tier: Porter Messages / Day | 20 | ✏️ |
| Pro Tier: AI Scans / Month | Unlimited | ✏️ |
| Pro Tier: BG Removals / Month | Unlimited | ✏️ |

**Feature Flags section:**
| Flag | Status | Description |
|------|--------|-------------|
| Registration Open | ✓ On | Allow new user signups |
| Maintenance Mode | ✗ Off | Show maintenance page to non-admins |
| eBay Integration | ✓ On | Allow eBay marketplace connections |
| Etsy Integration | ✓ On | Allow Etsy marketplace connections |
| Porter AI | ✓ On | Enable Porter chat |

Each change: inline edit → Save button → confirmation → audit log entry.

---

### 3.10 Audit Log (`/admin/audit`)

Who did what, when. Full accountability.

**Log table:**
| When | Admin | Action | Target | Details |
|------|-------|--------|--------|---------|
| Apr 24, 2:15 PM | stephen@... | Changed plan | jane@... | free → pro |
| Apr 24, 1:00 PM | stephen@... | Disabled account | spam@... | Reason: "Spam account" |
| Apr 23, 4:30 PM | eleanor@... | Changed setting | free_scan_limit | 25 → 30 |

**Features:**
- Filter by: admin user, action type, target type, date range
- Search by target email or action
- Exportable to CSV

---

## 4. API Routes (New)

All prefixed with `/admin/` and gated by `requireAuth` + `requireAdmin`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/stats` | Dashboard KPIs + chart data |
| GET | `/admin/activity` | Recent activity feed |
| GET | `/admin/users` | Paginated user list with filters |
| GET | `/admin/users/:id` | Single user with item/listing/order counts |
| PATCH | `/admin/users/:id` | Update role, tier, disabled status |
| DELETE | `/admin/users/:id` | Hard delete (with double confirm) |
| POST | `/admin/users/:id/reset-usage` | Zero out monthly counters |
| GET | `/admin/items` | All items, paginated, filterable |
| GET | `/admin/listings` | All listings, paginated, filterable |
| GET | `/admin/orders` | All orders, paginated, filterable |
| GET | `/admin/orders/revenue` | Revenue summary (total, fees, net) |
| GET | `/admin/conversations` | All Porter conversations |
| GET | `/admin/conversations/:id` | Single conversation messages |
| GET | `/admin/porter/stats` | AI usage metrics |
| GET | `/admin/marketplace/health` | All marketplace connections + status |
| GET | `/admin/settings` | All app settings |
| PATCH | `/admin/settings/:key` | Update a setting |
| GET | `/admin/audit` | Audit log, paginated, filterable |

**Pagination pattern:** `?page=1&limit=25&sort=created_at&order=desc`
**Filter pattern:** `?role=admin&tier=pro&status=active&q=search+term`

---

## 5. UX Principles (Non-coder Friendly)

| Principle | Implementation |
|-----------|---------------|
| No jargon | "Plan" not "subscription_tier", "Sales" not "orders" |
| Every action confirms | Modal with plain-English description before destructive ops |
| Color-coded everything | Green = good/active, Amber = warning, Red = error/disabled |
| Searchable everything | Global search in top bar + per-table search |
| Exportable | CSV download button on every table |
| Tooltips | Hover info on metrics ("This counts users who logged in today") |
| Undo where possible | "Account disabled — Undo (30 seconds)" toast |
| Empty states | Friendly messages when no data ("No orders yet — they'll show up here when users start selling") |
| Loading states | Skeleton screens, never blank white |
| Mobile functional | Sidebar collapses to hamburger menu, tables scroll horizontally |

---

## 6. Implementation Estimate

| Component | Tasks | Effort |
|-----------|-------|--------|
| DB migration (role, disabled_at, audit_log, app_settings) | 1 | Small |
| Auth changes (JWT role, requireAdmin middleware, seed script) | 1 | Small |
| Admin API routes (17 endpoints) | 3-4 | Medium |
| Admin layout (sidebar, top bar, responsive) | 1 | Small |
| Dashboard page | 1 | Medium |
| User management (list + detail) | 2 | Medium |
| Inventory/Listings/Orders admin views | 2 | Medium (reuse existing components) |
| Porter AI monitoring | 1 | Small |
| Marketplace health | 1 | Small |
| Settings page | 1 | Small |
| Audit log | 1 | Small |
| **Total** | **~15 tasks** | |

---

## 7. What This Does NOT Include (Future)

- Real-time WebSocket updates on dashboard
- Email/Slack notifications for admin alerts
- Advanced analytics (cohort analysis, retention curves)
- Multi-tenant admin (managing multiple Portage instances)
- API rate limiting controls
- Custom report builder

These can be added later without rearchitecting anything above.
