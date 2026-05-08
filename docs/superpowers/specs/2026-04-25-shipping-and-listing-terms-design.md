# Shipping UX & Listing Terms — Design Spec

**Date:** 2026-04-25
**Status:** Draft — awaiting user review
**Legal disclaimer:** Draft language requires attorney review before production use.

---

## 1. Overview

Two interconnected features:

1. **In-app shipping flow** — unified label purchasing across eBay and Etsy, with optional third-party provider support.
2. **Listing disclaimer** — liability protection requiring user confirmation before marketplace submission.

---

## 2. Shipping Flow

### 2.1 Provider Architecture

**Default (zero config):** Marketplace-native label purchasing via eBay Fulfillment API and Etsy Shipping Labels API. Users get the same discounted commercial rates they'd get buying labels directly on the marketplace.

**Optional third-party providers:** User can connect one of the following in Settings:
- Shippo
- EasyPost
- Pirate Ship

When a third-party provider is connected, the rate selection step shows rates from both the marketplace and the third-party side by side, clearly labeled with the source. User picks whichever option they prefer.

### 2.2 Entry Points

- **Sold celebration screen** → "Ship It" button
- **Order detail page** → "Ship" action (for orders in `payment_received` status)
- **Home page** → if pending shipments exist, a "Ship pending orders" card appears

### 2.3 Flow — Single Scrollable Screen

No wizard steps, no page transitions. One screen, scroll down through four sections:

#### Section 1: Item + Buyer (read-only)

- Item hero photo (thumbnail)
- Item name
- Sale price
- Marketplace source (eBay or Etsy badge)
- Buyer address (from order data, not editable by seller — comes from marketplace)

#### Section 2: Package

**Preset selector:** Horizontal scroll pills showing saved presets. AI pre-selects a preset based on item category and dimensions. If no presets exist yet, raw fields shown with AI suggestion pre-filled.

All fields are **editable regardless of whether AI filled them:**

| Field | Input Type | Notes |
|-------|-----------|-------|
| Package type | Segmented control | Box, Padded Envelope, Poly Mailer |
| Length | Numeric input | Inches |
| Width | Numeric input | Inches |
| Height | Numeric input | Inches |
| Weight (lbs) | Numeric input | Pounds |
| Weight (oz) | Numeric input | Ounces (alternative entry) |

**First-time prompt:** After the user confirms or adjusts dimensions, a subtle inline prompt: "Save as preset for next time?" with a name field. Dismissible.

**AI suggestion behavior:** Porter pre-selects the most likely preset based on item category (e.g., watches → "Padded mailer 6×4×3, 0.5lb"). The suggestion is visually indicated (e.g., "Suggested by Porter" label on the pill) but is a default selection, not a locked value. User can change to any preset or enter custom dimensions.

#### Section 3: Rate Selection

Rates refresh live when dimensions or weight change.

**Default view:** Top 3 rates:
- Cheapest
- Fastest
- Best value (balance of cost and speed)

Each rate card shows:
- Carrier + service name (e.g., "USPS Priority Mail")
- Carrier logo
- Price
- Estimated delivery window (e.g., "2-3 business days")
- Source label when third-party provider is connected (e.g., "via eBay" or "via Shippo")

**Expandable:** "Show all rates" link reveals the full list from all available sources.

#### Section 4: Buy Label

Single primary button: **"Buy Label — $X.XX"**

Price updates to match the selected rate. On tap:
1. Label purchased via the appropriate API (marketplace or third-party)
2. Tracking number pushed to marketplace automatically
3. Order status updates to `label_purchased`
4. Success state shows:
   - Checkmark animation
   - Tracking number displayed
   - "View Label" button (opens PDF)
   - "Mark as Shipped" button (or auto-mark option in settings)

### 2.4 After Purchase

**Order detail page updates to show:**
- Shipping label (viewable/printable as PDF)
- Tracking number with carrier
- Tracking status (pulled from marketplace or carrier API)
- "Mark as Shipped" button → updates order to `shipped`, notifies marketplace

**Status flow:**
```
payment_received → label_purchased → shipped → delivered
```

### 2.5 Settings — Shipping Section

Accessible from More → Settings → Shipping (or during first shipment setup via inline prompts).

**Ship-from address:**
- Full address fields (name, street, city, state, zip, country)
- Prompted inline during first shipment if not configured
- Editable anytime

**Package presets:**
- Create, edit, delete presets
- Each preset: name, package type, L × W × H, weight
- Reorderable (most-used first)

**Shipping provider:**
- Default: None (marketplace-native only)
- Options: Shippo, EasyPost, Pirate Ship
- API key field when provider selected
- "Test connection" button

**Preferences:**
- Default carrier preference (optional)
- Auto-mark as shipped after label purchase (toggle)
- Shipping notifications to buyer (toggle, where supported by marketplace)

---

## 3. Listing Disclaimer

### 3.1 Purpose

Portage uses AI to generate item descriptions, condition assessments, and estimated values. Before a listing is submitted to any marketplace, the user must confirm that they have reviewed and take responsibility for the listing content.

### 3.2 UX Placement

The disclaimer appears on the **listing review screen**, directly above the "Publish to [Marketplace]" button. The listing cannot be submitted without checking the checkbox.

**First time:** Disclaimer is expanded, showing full text. Checkbox unchecked.

**Subsequent times:** Disclaimer is collapsed to a single summary line with a "Review full terms" link. Checkbox still required each time.

### 3.3 Draft Disclaimer Language

> **⚠️ DRAFT — REQUIRES ATTORNEY REVIEW BEFORE PRODUCTION USE**

---

**Listing Confirmation & Seller Responsibility**

By checking this box, I confirm and agree to the following:

**Accuracy & Representation**

1. I have reviewed all listing content including the title, description, condition assessment, photos, and pricing before submission.
2. All photos are of the actual item being offered for sale and accurately represent its current condition. No stock photos, AI-generated images, or photos of a different item have been used.
3. The item description, whether generated by AI or written by me, accurately represents the item I am offering for sale.
4. I have verified the condition assessment and any noted defects, wear, or damage are truthfully disclosed.

**AI-Generated Content**

5. I understand that Portage uses artificial intelligence to assist with item identification, description generation, condition assessment, and value estimation. These are suggestions only and may contain errors.
6. I am solely responsible for verifying the accuracy of all AI-generated content before publishing. Portage does not guarantee the accuracy of AI-generated descriptions, valuations, or condition assessments.
7. I have made any necessary corrections to AI-generated content to ensure it accurately represents my item.

**Marketplace Compliance**

8. I am responsible for ensuring my listing complies with all applicable terms of service, policies, and guidelines of the marketplace on which it is being published (including but not limited to eBay and Etsy).
9. I understand that Portage is a listing tool and is not a party to any transaction between me and a buyer.

**Liability**

10. I understand that Portage, Digital Harmony Group, and their officers, employees, and agents are not liable for any claims, disputes, returns, refunds, or damages arising from the sale of this item.
11. I am the lawful owner of this item and have the legal right to sell it.
12. I accept full responsibility for the accuracy of this listing and any consequences resulting from inaccuracies.

---

*By checking this box, I acknowledge that I have read, understood, and agree to the above terms for this listing.*

☐ **I confirm this listing is accurate and I accept responsibility**

[Publish to eBay] / [Publish to Etsy]

---

### 3.4 Data Retention

- Timestamp of each disclaimer acceptance stored per listing
- Version of disclaimer text stored (for future updates to language)
- This creates an audit trail showing the user confirmed each listing

### 3.5 Disclaimer Versioning

When the disclaimer language is updated:
- All users see the expanded (full text) version on their next listing
- Previous acceptances remain valid for already-published listings
- Version number incremented and stored with each acceptance

---

## 4. Design Principles

These apply across both features:

1. **Every AI-filled field is editable.** AI suggests, user owns. No locked fields from AI output — dimensions, weight, package type, descriptions, values, condition, all of it.
2. **Zero config to start.** Shipping works with marketplace-native labels immediately. No provider setup required. Ship-from address prompted inline during first use.
3. **Progressive disclosure.** Show what matters, hide what doesn't. Top 3 rates, not 18. Collapsed disclaimer after first viewing. Presets over raw fields.
4. **One screen, no wizards.** The shipping flow is a single scrollable page, not a multi-step wizard. Every piece of information is visible and editable without page transitions.
5. **Apple-level minimalism.** No corporate card grids or form-heavy layouts. Bold typography, generous whitespace, confident color. The shipping screen should feel as premium as the rest of the app.

---

## 5. Database Changes

### 5.1 Existing (no changes needed)

The `orders` table already has:
- `shippingCost` (real)
- `trackingNumber` (varchar 255)
- `carrier` (varchar 100)
- `shippingLabelUrl` (text)
- `shippedAt` (timestamp)
- `status` enum: `payment_received`, `label_purchased`, `shipped`, `delivered`

### 5.2 New Tables

**`shipping_presets`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK to users |
| name | varchar(100) | e.g., "Small box" |
| packageType | varchar(50) | box, envelope, poly_mailer |
| length | real | inches |
| width | real | inches |
| height | real | inches |
| weightLbs | real | pounds |
| weightOz | real | ounces |
| isDefault | boolean | default false |
| sortOrder | integer | for reordering |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**`shipping_providers`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK to users |
| provider | varchar(50) | shippo, easypost, pirate_ship |
| apiKey | text | encrypted at rest (AES-256-GCM, same as marketplace tokens) |
| isActive | boolean | |
| createdAt | timestamp | |

**`disclaimer_acceptances`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK to users |
| listingId | uuid | FK to listings |
| disclaimerVersion | integer | version of text accepted |
| acceptedAt | timestamp | |
| ipAddress | varchar(45) | for audit trail |

### 5.3 New Columns

**`users` table — add:**
| Column | Type | Notes |
|--------|------|-------|
| shipFromAddress | jsonb | { name, street1, street2, city, state, zip, country } |
| shippingAutoMark | boolean | default false — auto-mark shipped after label purchase |

---

## 6. API Endpoints

### Shipping
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/shipping/rates | Get rates for an order (pass orderId + package dimensions) |
| POST | /api/shipping/labels | Purchase a label |
| GET | /api/shipping/labels/:orderId | Get label PDF URL |
| POST | /api/orders/:id/ship | Mark order as shipped |

### Shipping Presets
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/shipping/presets | List user's presets |
| POST | /api/shipping/presets | Create preset |
| PUT | /api/shipping/presets/:id | Update preset |
| DELETE | /api/shipping/presets/:id | Delete preset |

### Shipping Provider
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/shipping/provider | Get user's configured provider |
| PUT | /api/shipping/provider | Set/update provider + API key |
| POST | /api/shipping/provider/test | Test provider connection |

### Disclaimer
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/listings/:id/accept-terms | Record disclaimer acceptance |
| GET | /api/disclaimer/version | Get current disclaimer version |

---

## 7. Multi-Item Orders

When a buyer purchases multiple items in a single order (or the seller wants to combine shipments):

### 7.1 Detection

- Order sync from marketplace flags multi-item orders
- Seller can also manually combine separate orders going to the same buyer address via a "Combine shipments" action

### 7.2 Shipping Flow Changes

The Ship It screen adapts for multi-item:

**Section 1 (Item + Buyer)** shows all items in the order as a stacked list — photo, name, and sale price for each. Buyer address remains single.

**Section 2 (Package)** — the key decision: one box or multiple?

- Default: single package. AI suggests a preset based on the combined items.
- "Split into multiple packages" toggle — when enabled, each item gets its own package section with independent dimensions/weight. Each package gets its own label.

**Section 3 (Rates)** — for single package, works as normal. For split packages, rates shown per package with a combined total at the bottom.

**Section 4 (Buy Label)** — "Buy Label — $X.XX" for single package, or "Buy 2 Labels — $X.XX total" for split.

### 7.3 After Purchase

Each package gets its own tracking number. All tracking numbers pushed to the marketplace. Order detail shows all packages with individual tracking.

---

## 8. Mobile Label Printing

### 8.1 Options Presented After Label Purchase

After buying a label, the success screen shows three options:

| Option | How It Works |
|--------|-------------|
| **View Label** | Opens PDF in browser — user can print from there (AirPrint on iOS, system print on Android) |
| **Email Label** | Sends label PDF to the user's email address on file. User prints from desktop. |
| **Save to Files** | Downloads PDF to device storage (Files app on iOS, Downloads on Android) |

### 8.2 Implementation

- Label is always stored as a PDF URL in `shippingLabelUrl`
- "View Label" opens the URL in a new tab — browsers handle print natively
- "Email Label" hits a backend endpoint that sends the PDF as an attachment via the existing notification email infrastructure
- "Save to Files" triggers a download via the browser's download API

### 8.3 Re-access

Label is always accessible from the order detail page via a "View Label" button. Can be re-emailed or re-downloaded at any time.

---

## 9. Decisions Log

| Question | Decision |
|----------|----------|
| International shipping (customs forms) | v2 — domestic only for initial release |
| Multi-item orders | v1 — designed in Section 7 |
| Mobile label printing | v1 — designed in Section 8 |
| Pirate Ship API | Investigate availability before committing to support |
| Legal review of disclaimer | Owner to engage e-commerce/technology attorney for review of Section 3.3 |

---

## 10. Open Questions

1. **Pirate Ship API access** — needs investigation. May require partnership approval. If unavailable, drop from initial provider list (Shippo + EasyPost only).
2. **Legal review** — disclaimer language in Section 3.3 is a draft. Must be reviewed by a licensed e-commerce/technology attorney before production deployment.
