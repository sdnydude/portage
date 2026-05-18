---
slug: features
title: Features
sidebar_label: Features
sidebar_position: 2
---

# Portage Features

*Last updated: 2026-05-18*

Portage is an AI-powered personal effects inventory and multi-marketplace seller app. This document covers every shipped feature, its implementation status, and what makes it unique in the reseller tool market.

---

## Only in Portage

These features exist in no competing product (verified against 11 competitors — see [Competitive Analysis](./competitive-analysis.md)):

### AI Scan → Comp Pricing → One-Tap Listing

Scan an item with your camera → AI identifies it instantly → real eBay sold comps are fetched → a draft listing is created at market price — all in a single tap.

- **Advantage:** Eliminates the research-then-list workflow that takes 10-15 minutes per item with other tools
- **Benefit:** List 4-6x more items per hour; pricing grounded in real market data instead of guesswork
- **Nearest competitor:** Underpriced AI does scan + pricing but has no listing creation, no inventory, no marketplace publish

### Porter AI with Live Inventory Access

Conversational assistant powered by Claude Sonnet with tool_use — searches your actual inventory, queries stats, and suggests listings based on what you own.

- **Advantage:** Unlike generic chatbots, Porter has function-calling access to your real data (items, prices, conditions, photos)
- **Benefit:** Ask "what should I list next?" and get actionable answers based on your highest-value unsold inventory
- **Nearest competitor:** 3Dsellers has a chatbot but no real-time inventory query capability

### Three Listing UX Modes

Choose how you create listings: Conversational (guided Q&A), Swipe (card stack for speed), or Hybrid (chat + inline editable cards).

- **Advantage:** Adapts to your workflow — quick-list 20 similar items in Swipe mode, or get AI guidance on unfamiliar categories in Conversational
- **Benefit:** Reduces listing fatigue; new sellers get guidance while experienced sellers get speed
- **Nearest competitor:** Nobody — every other tool offers a single form paradigm with no UX variation

### Zero-Cost Background Removal

Runs entirely in your browser via WebAssembly — no server round-trip, no API fee, no monthly quota.

- **Advantage:** Process unlimited photos with no per-image cost; works offline after initial WASM load
- **Benefit:** Professional product photos on every listing without paying $10-50/mo for PhotoRoom or burning through monthly caps
- **Nearest competitor:** All others (Crosslist, List Perfectly, Vendoo) use PhotoRoom with 50-200/month caps

### Comp Cards with Inline Actions

Expandable sold/active comp cards with thumbnails, prices, sold dates, and one-tap "Use Title", "Use Condition", "View on eBay" — surfaced right in the scan and inventory screens.

- **Advantage:** See exactly what your item sold for on eBay and borrow proven titles/conditions without switching tabs
- **Benefit:** Better SEO titles (proven to sell), accurate condition mapping, confident pricing — all without leaving your workflow
- **Nearest competitor:** No competitor surfaces actionable comp data inline during item creation

### Reverb Marketplace Support

The only cross-listing tool that supports Reverb — the marketplace for musical instruments, audio gear, and DJ equipment.

- **Advantage:** Reach the #1 marketplace for instruments ($1B+ annual GMV) that no other tool connects to
- **Benefit:** Musicians and gear resellers can manage Reverb alongside eBay/Etsy in one app instead of switching between platforms
- **Nearest competitor:** Nobody — not even the 15-marketplace tools support Reverb

---

## Shared Features Done Better

These features exist in other tools, but Portage's implementation offers distinct advantages:

| Feature | What others do | What Portage does better |
|---------|---------------|--------------------------|
| **AI Item Scanning** | Barcode lookup (List Perfectly) or basic image match (Underpriced) | Claude Vision with multi-candidate results, confidence scores, feature extraction, and AI reasoning display |
| **AI Listing Generation** | Template-fill from image context alone | Generates from comps data + seller profile + marketplace-specific optimization (80-char eBay titles, HTML descriptions) |
| **Background Removal** | Server-side API with monthly caps (50-200 images) | Client-side WASM — unlimited, zero-cost, works offline, no account needed |
| **Bulk CSV Export** | Generic CSV download | eBay Seller Hub Reports format with Action headers, numeric category IDs, pipe-delimited photos — ready for direct bulk import |
| **Mobile Experience** | Responsive web or native app requiring App Store approval | PWA installable from browser — no App Store review, no 30% Apple tax, instant updates |
| **Photo Editing** | Upload and maybe crop | Full pipeline: capture → crop → rotate → enhance → BG remove → before/after preview, all inline |
| **Pricing** | AI guesses from image context | Real eBay sold/active comps with median/average stats and sample size — data-driven, not AI hallucination |
| **Onboarding** | Dump user into a form | 5-step guided carousel that teaches the app while collecting preferences |
| **Seller Profiles** | One-size-fits-all listings | Configurable defaults (return policy, shipping, condition preferences) that feed AI generation |
| **Billing** | Fixed tiers with hard limits | Tiered subscriptions + credit packs for overflow — never blocked mid-workflow |

---

## Feature Inventory

### AI & Intelligence

| Feature | Status | Description |
|---------|--------|-------------|
| AI Item Scanning | Shipped | Claude Vision identifies items from photos — name, category, brand, model, features, value range, condition |
| Multi-Candidate Results | Shipped | AI returns ranked candidates with confidence scores; user picks the best match |
| AI Reasoning Display | Shipped | Collapsible "Why this identification?" showing the AI's reasoning steps |
| Comp-Grounded Pricing | Shipped | Real eBay sold/active comparable listings feed pricing decisions |
| AI Listing Generation | Shipped | `prepare-listing` endpoint generates optimized titles, descriptions, pricing from comps + seller profile |
| Porter AI Assistant | Shipped | Conversational AI with 3 tools: search_inventory, get_inventory_stats, suggest_listing |
| Auto-Enhance | Shipped | Server-side Sharp pipeline for photo enhancement (billing-gated) |

### Photo Pipeline

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-Photo Capture | Shipped | Camera capture up to 12 photos per item with upload-on-capture |
| Gallery Import | Shipped | Pick existing photos from device gallery |
| Background Removal | Shipped | @imgly/background-removal WASM — runs entirely in-browser |
| Crop Tool | Shipped | Interactive crop with aspect ratio options |
| Rotate | Shipped | 90-degree rotation with server-side processing |
| Before/After Preview | Shipped | Slider comparison for enhance and BG removal results |
| Cloud Storage | Shipped | Cloudflare R2 with direct upload and CDN delivery |

### Scan Flow

| Feature | Status | Description |
|---------|--------|-------------|
| Camera → Upload → AI Scan | Shipped | Full pipeline from photo capture to AI identification |
| Editable Results | Shipped | All AI-generated fields are editable before saving |
| eBay Comp Price Badge | Shipped | Shows median sold price with sample size after scan |
| Expandable Comp Cards | Shipped | Sold and active comps with thumbnails, prices, Use Title/Condition actions |
| Save & List Shortcut | Shipped | One-tap: saves item + creates eBay draft at comp price |
| Inline Photo Editing | Shipped | Rotate, crop, enhance, BG remove without leaving scan flow |
| Rescan | Shipped | Re-run AI on same photos if identification is wrong |

### Inventory Management

| Feature | Status | Description |
|---------|--------|-------------|
| Item Grid/List View | Shipped | Toggle between visual grid and compact list |
| Search & Filter | Shipped | Full-text search with condition/category/marketplace filters |
| Item Detail & Edit | Shipped | Full edit page with photo management, comp lookup, value tracking |
| Quick List for Sale | Shipped | Creates eBay draft at comp pricing from inventory detail page |
| Bulk Select | Shipped | Multi-select with bulk delete, archive, activate, export |
| eBay CSV Export | Shipped | Seller Hub Reports format for bulk draft import |
| Pagination | Shipped | Infinite scroll with server-side pagination |

### Listing Flow

| Feature | Status | Description |
|---------|--------|-------------|
| Hybrid Mode (default) | Shipped | Chat guidance + inline editable cards + photo hero |
| Conversational Mode | Shipped | Porter-guided step-by-step Q&A |
| Swipe Mode | Shipped | Card stack for rapid field entry |
| AI Field Generation | Shipped | Titles, descriptions, pricing from comps and seller profile |
| Draft Persistence | Shipped | Auto-saves progress; resume later |
| Photo Capture Flow | Shipped | Dedicated photo stage within listing creation |
| Marketplace Selection | Shipped | Choose target marketplace before publishing |
| Listings CRUD | Shipped | Create, edit, update, delete with marketplace sync |
| Listing Detail Page | Shipped | Full view with status, marketplace link, pricing, photos |

### Marketplace Integrations

| Feature | Status | Description |
|---------|--------|-------------|
| eBay OAuth2 | Shipped | Full auth code grant flow with encrypted token storage |
| eBay Inventory API | Shipped | SKU/offer/publish workflow, listing sync |
| eBay Comps (Browse API) | Shipped | Sold + active comparable search with stats |
| eBay Taxonomy | Shipped | Category suggestion from item metadata |
| Etsy PKCE OAuth2 | Shipped | Auth flow with photo upload support |
| Etsy Listings API | Shipped | Create/update/deactivate with receipts |
| Reverb Token Auth | Shipped | Personal Access Token validated against live API |
| Reverb Comps Search | Shipped | Comparable listings for musical instruments |
| Reverb OAuth Code Grant | Planned | Full OAuth2 flow (token-paste auth is live) |

### Orders & Shipping

| Feature | Status | Description |
|---------|--------|-------------|
| Orders List | Shipped | All orders with status, buyer info, items |
| Order Detail | Shipped | Full order view with shipping address, tracking |
| Order Sync | Shipped | Pull orders from connected marketplaces |
| Ship Order Flow | Shipped | Step-by-step shipping workflow UI |
| Shipping Presets | Shipped | Save common package dimensions/weights |
| Shipping Provider Config | Shipped | Connect Shippo or EasyPost accounts |
| Rate Quotes | Partial | UI built; carrier API calls stubbed |
| Label Purchase | Partial | UI built; carrier API calls stubbed |

### Billing & Monetization

| Feature | Status | Description |
|---------|--------|-------------|
| Stripe Subscriptions | Shipped | Free and Pro tiers with automatic enforcement |
| Credit Packs | Shipped | Purchase additional AI credits beyond tier limits |
| Usage Gates | Shipped | AI scans, listings, BG removals, Porter messages gated per tier |
| Webhook Processing | Shipped | Stripe events processed for subscription lifecycle |
| Billing Settings Page | Shipped | Plan management, usage display, credit purchase |

### User Experience

| Feature | Status | Description |
|---------|--------|-------------|
| Onboarding Flow | Shipped | 5-step first-time user carousel |
| Mobile-First PWA | Shipped | Installable, 5-tab bottom nav, safe-area support |
| Dark Mode | Shipped | System preference-driven with CSS variables |
| Glass Morphism UI | Shipped | Backdrop-filter panels with `@supports` fallback |
| Sold Celebration | Shipped | Confetti animation on successful sale |
| Settings (8 pages) | Shipped | Profile, marketplace, seller profile, shipping, billing, notifications, help, admin |

### Admin & Ops

| Feature | Status | Description |
|---------|--------|-------------|
| Admin Dashboard | Shipped | User stats, system health, recent activity |
| User Management | Shipped | List, search, promote/demote, view details |
| Admin Audit Log | Shipped | All admin actions logged with timestamp and actor |
| App Settings | Shipped | System-wide configuration from admin panel |
| Prometheus Metrics | Shipped | 7 custom metrics + /metrics endpoint |
| Grafana Dashboard | Shipped | Pre-configured panels for API observability |

### Security

| Feature | Status | Description |
|---------|--------|-------------|
| JWT + Refresh Tokens | Shipped | Auto-refresh on 401 with retry |
| AES-256-GCM Token Encryption | Shipped | Marketplace OAuth tokens encrypted at rest |
| Role-Based Access | Shipped | User/Admin roles with middleware guards |
| Input Validation | Shipped | Zod schemas on all route inputs |
| SQL Injection Prevention | Shipped | ILIKE escape for `%` and `_` characters |
| XSS Protection | Shipped | Helmet + strict CORS |

---

## Planned Features

| Feature | Priority | Rationale |
|---------|----------|-----------|
| Poshmark Adapter | High | #1 competitive gap — most requested marketplace |
| Mercari Adapter | High | Second most-requested marketplace for resellers |
| Carrier API Integration | Medium | EasyPost/Shippo live rate quotes and label purchase |
| Buyer Messaging | Medium | In-app message management across marketplaces |
| Reverb OAuth Code Grant | Low | Token-paste auth works; OAuth is polish |

---

## Implementation Reference

For developers working on these features:

| Area | Key Files |
|------|-----------|
| AI Scanning | `apps/api/src/lib/vision.ts`, `apps/web/src/components/capture/scan-flow.tsx` |
| Comp Search | `apps/api/src/routes/items.ts` (GET /items/comps/search), Browse API client |
| Listing Flow | `apps/web/src/components/listing-flow/`, `apps/web/src/hooks/use-listing-flow.ts` |
| Porter AI | `apps/api/src/routes/porter.ts`, tool definitions in route file |
| Photo Tools | `apps/web/src/hooks/use-enhance.ts`, `use-bg-removal.ts`, `apps/api/src/routes/images.ts` |
| Marketplace Adapters | `apps/api/src/marketplace/` (ebay-adapter, etsy-adapter, reverb-adapter) |
| Billing | `apps/api/src/routes/billing.ts`, Stripe webhook handler |
| Admin | `apps/api/src/routes/admin.ts`, `apps/web/src/app/admin/` |
| Shared Types | `packages/shared/src/types.ts`, `packages/shared/src/marketplace.ts` |
