# eBay RESTful API Reference for Portage

Scraped from developer.ebay.com via Context7 — 2026-05-07

---

## API Structure

### Base URLs

| Environment | Domain |
|-------------|--------|
| Production  | `https://api.ebay.com` |
| Sandbox     | `https://api.sandbox.ebay.com` |

### URI Format

```
https://api.ebay.com/{context}/{api_name}/{version}/{resource}/{path_params}?{query_params}
```

| Component | Example | Description |
|-----------|---------|-------------|
| Context | `/sell`, `/buy`, `/commerce`, `/developer` | API area |
| API Name | `/fulfillment`, `/inventory` | Specific API |
| Version | `/v1` | Major version |
| Resource | `/order`, `/product` | Target resource |
| Path Params | `/{orderId}` | Specific instance (curly braces) |
| Query Params | `?fieldGroups=_string_` | Filters, pagination |

### HTTP Methods

| Method | Use |
|--------|-----|
| `GET` | Retrieve resources (no side effects) |
| `POST` | Create or submit data |
| `PUT` | Update or create at specific URI |
| `DELETE` | Remove resources |

---

## Authentication

### OAuth2 (REST APIs)

All REST API calls use OAuth Bearer tokens:

```
Authorization: Bearer v^1.1...tokenvalue
```

### Required Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {access_token}` | Yes |
| `Content-Type` | `application/json` | Yes (POST/PUT) |
| `X-EBAY-C-MARKETPLACE-ID` | `EBAY_US` | Yes (most calls) |

---

## Error & Warning Responses

### Structure

```json
{
  "warnings": [
    {
      "errorId": 12345,
      "domain": "string",
      "subDomain": "string",
      "category": "ErrorCategory",
      "message": "string",
      "longMessage": "string",
      "inputRefIds": ["string"],
      "outputRefIds": ["string"],
      "parameters": [{ "name": "string", "value": "string" }]
    }
  ],
  "errors": [
    {
      "errorId": 67890,
      "domain": "string",
      "subDomain": "string",
      "category": "ErrorCategory",
      "message": "string",
      "longMessage": "string",
      "inputRefIds": ["string"],
      "outputRefIds": ["string"],
      "parameters": [{ "name": "string", "value": "string" }]
    }
  ]
}
```

### Response Scenarios

| Scenario | HTTP Status | Description |
|----------|-------------|-------------|
| Success, no issues | `200` | No `errors` or `warnings` in body |
| Success with warnings | `200` | `warnings` array present, no `errors` |
| Error | `4xx` / `5xx` | `errors` array present, no `warnings` |

---

## APIs Relevant to Portage

### Sell APIs (for professional sellers)

#### 1. Inventory API (`/sell/inventory/v1`)

Primary API for Portage listing creation. REST-based, modular approach:

- **Inventory Item** — Create/manage item records (title, description, images, aspects)
- **Offer** — Create marketplace-specific offers (price, quantity, policies)
- **Publish** — Make offers live as eBay listings

**Key Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `PUT` | `/inventory_item/{sku}` | Create/update inventory item by SKU |
| `GET` | `/inventory_item/{sku}` | Get inventory item |
| `GET` | `/inventory_item` | List all inventory items |
| `DELETE` | `/inventory_item/{sku}` | Delete inventory item |
| `POST` | `/offer` | Create an offer for an item |
| `GET` | `/offer/{offerId}` | Get offer details |
| `POST` | `/offer/{offerId}/publish` | Publish offer → returns `listingId` |
| `PUT` | `/inventory_item_group/{inventoryItemGroupKey}` | Multi-variation listings |

**Listing Creation Flow:**
1. `PUT /inventory_item/{sku}` — Create the item with details
2. `POST /offer` — Create an offer (price, marketplace, policies)
3. `POST /offer/{offerId}/publish` — Go live → returns `listingId`

#### 2. Fulfillment API (`/sell/fulfillment/v1`)

Order management and shipping:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/order` | Search/list orders |
| `GET` | `/order/{orderId}` | Get order details |
| `POST` | `/order/{orderId}/shipping_fulfillment` | Create shipping fulfillment |
| `GET` | `/order/{orderId}/shipping_fulfillment` | List fulfillments for order |

#### 3. Account API (`/sell/account/v1`)

Store settings and policies:

- Return policies
- Payment policies
- Shipping policies (fulfillment policies)
- Sales tax settings

#### 4. Marketing API (`/sell/marketing/v1`)

Promoted Listings and campaigns:

- Create ad campaigns
- Add listings by SKU or inventory reference
- Manage discounts and promotions

### Buy APIs

#### 5. Browse API (`/buy/browse/v1`)

Used by Portage for **comps** (comparable listings):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/item_summary/search` | Search active listings |
| `GET` | `/item/{itemId}` | Get item details |

### Commerce APIs

#### 6. Taxonomy API (`/commerce/taxonomy/v1`)

Category and aspect lookup:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/category_tree/{categoryTreeId}` | Get category tree |
| `GET` | `/category_tree/{categoryTreeId}/get_item_aspects_for_category` | Get required aspects for a category |

#### 7. Catalog API (`/commerce/catalog/v1`)

Product matching:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/product/{epid}` | Get product by eBay Product ID |
| `GET` | `/product_summary/search` | Search catalog products |

---

## Listing Creation Methods Comparison

| Method | Type | Best For |
|--------|------|----------|
| **Inventory API** | REST | Single items, modular updates (Portage uses this) |
| **Sell Feed API** | REST + bulk files | Bulk uploads (1000s of items) |
| **Trading API** | XML/SOAP (legacy) | Legacy integrations |

---

## Portage's Current eBay Integration

**Adapter:** `apps/api/src/marketplace/ebay-adapter.ts`
**Auth:** `apps/api/src/routes/marketplace/ebay-auth.ts`
**Token Manager:** `apps/api/src/marketplace/token-manager.ts`

**Currently implemented:**
- OAuth2 auth code grant (connect/disconnect/status)
- Token encryption (AES-256-GCM)
- Inventory API: create/update/delete items, create offers, publish
- Fulfillment API: get orders
- Taxonomy API: category lookup
- Browse API: search for comps

**OAuth Scopes requested:**
- `sell.inventory` — SKU/offer/publish
- `sell.marketing` — ad campaigns
- `sell.account` — store policies
- `sell.fulfillment` — orders/shipping
- `commerce.identity.readonly` — user profile
