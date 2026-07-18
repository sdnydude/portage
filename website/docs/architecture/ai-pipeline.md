---
id: ai-pipeline
title: AI Pipeline
sidebar_position: 3
---

import ThemedImage from '@theme/ThemedImage';

# AI Pipeline

Portage uses AI for item identification, listing preparation, background removal, photo enhancement, and the Porter conversational assistant.

<ThemedImage
  alt="AI pipeline: vision chain and Porter"
  sources={{light: '/portage/img/ai-pipeline-chain.svg', dark: '/portage/img/ai-pipeline-chain-dark.svg'}}
/>

## Item Scanning

The scanning pipeline identifies items from photos through a **configurable vision provider chain** (see [AI Provider Chain](#ai-provider-chain) below) — Gemini 2.5 is the primary provider with Claude as fallback.

### Single-Image Scan

`POST /scan` — identifies an item from a single image URL.

The vision module (`apps/api/src/lib/vision.ts`) sends the image through the provider chain with a structured prompt requesting name, category, condition, brand, model, value estimates, and confidence score. The response is validated against a Zod schema.

### Multi-Image Refined Scan

`POST /scan/refine` — the primary scanning endpoint, accepts 1-3 image URLs.

```
Photos (R2 URLs) → SSRF validation → Vision provider chain (multi-image) → Zod parse → Candidates
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

Porter is a conversational AI assistant accessible from the Porter tab. It uses the configurable chat-provider chain (`CHAT_PROVIDERS` — Claude Sonnet in prod) with **SSE streaming** (`POST /porter/stream`, with `POST /porter/message` as a non-streaming fallback) in a **tool_use loop** with three tools:

| Tool | Purpose |
|------|---------|
| `search_inventory` | Search user's items by keyword |
| `get_inventory_stats` | Get portfolio summary stats |
| `suggest_listing` | Generate listing suggestions for an item |

Porter maintains conversation history per user via the `conversations` table.

## Background Removal

Server-side background removal via `POST /images/remove-bg`, backed by the dedicated `portage-rembg` container (rembg, port 7000):

1. User taps "Remove BG" on a photo (billing-gated per tier)
2. The API fetches the image and posts it to the rembg service
3. The transparent cutout is flattened onto a white background (transparency renders as black in eBay exports)
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

The AI system (`apps/api/src/lib/ai-client.ts`) supports a 5-provider fallback chain, configured per capability via the `VISION_PROVIDERS` and `CHAT_PROVIDERS` env vars (comma-separated, tried in order — Gemini 2.5 primary with Claude fallback in the current configuration):

| Provider | Default Vision Model | Default Chat Model |
|----------|---------------------|--------------------|
| `local` (Ollama / vLLM / llama.cpp) | qwen3-vl | qwen3:8b |
| `gemini` | gemini-2.5-pro | gemini-2.5-flash |
| `openai` | gpt-4.1 | gpt-4o-mini |
| `huggingface` | Qwen/Qwen2.5-VL-7B-Instruct | Llama-3.1-8B-Instruct |
| `anthropic` | Claude Sonnet | Claude Sonnet |

If a provider fails, the chain falls through to the next entry; a `provider:model` chain entry overrides that provider's model. Clients are cached as singletons via `getAnthropicClient()` and `getOpenAIClient()` helpers (Map-cached, one instance per provider).
