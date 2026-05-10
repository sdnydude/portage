---
id: ai-pipeline
title: AI Pipeline
sidebar_position: 3
---

# AI Pipeline

Portage uses AI for item identification, listing preparation, background removal, photo enhancement, and the Porter conversational assistant.

## Item Scanning

The scanning pipeline uses **Claude Vision** to identify items from photos.

### Single-Image Scan

`POST /scan` — identifies an item from a single image URL.

The vision module (`apps/api/src/lib/vision.ts`) sends the image to Claude with a structured prompt requesting name, category, condition, brand, model, value estimates, and confidence score. The response is validated against a Zod schema.

### Multi-Image Refined Scan

`POST /scan/refine` — the primary scanning endpoint, accepts 1-3 image URLs.

```
Photos (R2 URLs) → SSRF validation → Claude Vision (multi-image) → Zod parse → Candidates
```

The refine endpoint returns:
- **Candidates**: Multiple possible identifications with confidence percentages
- **Reasoning**: AI explanation of its identification logic
- **Detailed fields**: Name, category, condition, brand, model, features, value range

SSRF protection validates all image URLs against the `R2_PUBLIC_URL` prefix. If the env var is unset, the endpoint rejects all URLs (fail-closed).

### Scan Limits

Free-tier users are limited in daily scans. The `checkScanLimit()` helper validates the user exists and checks their scan count. Missing users result in a 401 error rather than silently bypassing the limit.

## Listing Preparation

`POST /items/:id/prepare-listing` — AI-generated listing fields.

Given an item's data and target marketplaces, the AI generates:
- Optimized title (marketplace-specific length limits)
- SEO-friendly description
- Pricing recommendation (based on eBay comps data)
- Suggested category mappings

The seller profile (return policy, shipping terms) is incorporated into the generated listing.

## Porter AI Assistant

Porter is a conversational AI assistant accessible from the Porter tab. It uses Claude Sonnet in a **tool_use loop** with three tools:

| Tool | Purpose |
|------|---------|
| `search_inventory` | Search user's items by keyword |
| `get_inventory_stats` | Get portfolio summary stats |
| `suggest_listing` | Generate listing suggestions for an item |

Porter maintains conversation history per user via the `conversations` table.

## Background Removal

Client-side WASM-based background removal using `@imgly/background-removal`. No server round-trip required:

1. User taps "Remove BG" on a photo
2. WASM model loads in the browser
3. Background is removed client-side
4. Result uploads to R2 as a new image

The `useBgRemoval` hook manages the processing state and result.

## Photo Enhancement

Server-side enhancement via `POST /images/enhance`:

1. Original image fetched from R2
2. Sharp pipeline applies auto-level, sharpen, and color correction
3. Enhanced image uploads to R2
4. New URL returned to client

The `useEnhance` hook wraps this flow.

## AI Provider Chain

The AI system supports a 5-provider fallback chain:

| Priority | Provider | Model |
|----------|----------|-------|
| 1 | Anthropic | Claude Sonnet |
| 2 | OpenAI | GPT-4 Vision |
| 3 | Google | Gemini |
| 4 | HuggingFace | Open models |
| 5 | Local | llama3.2-vision / qwen3:4b |

Clients are cached as singletons via `getAnthropicClient()` and `getOpenAIClient()` helpers (Map-cached, one instance per provider).
