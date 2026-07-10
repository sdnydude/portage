---
id: listing-flow
title: Listing Flow
sidebar_position: 3
---

# Listing Flow

The listing flow is Portage's core feature — creating marketplace listings through one of three interfaces that all share a common state machine.

## Three Interfaces

Users choose their preferred listing experience in settings. All three share the same `useListingFlow` hook and publish path.

### Hybrid Flow (Default)

Porter-guided chat bubbles alongside inline cards. Combines AI guidance with direct field editing:

- Photo hero with capture/upload
- AI recognition card with candidate selection
- Metadata fields (title, description, category, condition)
- Pricing strategy picker (Fast Sale / Market Price / Maximize)
- Marketplace selector (eBay, Reverb — Etsy was parked 2026-07-09 pending API key approval)
- Shipping configuration card
- Fee estimate breakdown

### Conversational Flow

Step-by-step Q&A format driven by Porter's text prompts. Each step is a question-and-answer interaction, suited for users who prefer guided workflows.

### Swipe Flow

Card-stack rapid-entry mode for bulk listing. Swipe gestures for quick decisions, optimized for listing many items quickly.

## State Machine

The `useListingFlow` hook (`apps/web/src/hooks/use-listing-flow.ts`) manages the entire listing lifecycle. Progress is tracked as `lastStepCompleted` checkpoints (persisted with the draft):

```
idle → recognizing → recognition → confirmed → details → pricing → published
       (error paths: recognition-failed, publish-failed)
```

### Key Actions

| Action | Description |
|--------|-------------|
| `startFromPhoto(photos)` | Begin flow with captured photos |
| `startFromItem(itemId)` | Begin flow from an existing inventory item |
| `resumeDraft(draftId)` | Continue a saved draft |
| `confirmRecognition(candidate)` | Accept an AI identification |
| `fetchComps(query)` | Load eBay comparable sales |
| `applyPricingStrategy(strategy)` | Set pricing from comp data |
| `addPhotos(files)` | Add more photos to the listing |
| `publish()` | Submit to marketplace |
| `cancel()` | Exit the flow |

`publish()` creates the inventory item first if needed (`ensureItemCreated`), runs prepare-listing for marketplace-specific fields (non-fatal on failure), and sends a scoped idempotency key per publish attempt so retries and replays cannot create duplicate listings. eBay supports both `draft` and `live` publish modes (defaulted from the seller profile's `ebayPublishMode`, with a per-publish toggle).

## Auto-Draft Persistence

Listing drafts auto-save every 2 seconds via the `useDrafts` hook's `debouncedSave`. Drafts persist across sessions, so users can start a listing on their phone and finish later.

```
User edits field → debouncedSave (2s delay) → POST /drafts → saved
```

## Pricing Strategy

Three built-in pricing strategies based on eBay comp data:

| Strategy | Calculation | Use Case |
|----------|-------------|----------|
| Fast Sale | 85% of median comp price | Quick turnover |
| Market Price | Median comp price | Standard pricing |
| Maximize | 120% of median comp price | Premium items |

## Components

Located in `apps/web/src/components/listing-flow/`:

| Component | Purpose |
|-----------|---------|
| `hybrid-flow.tsx` | Default hybrid interface |
| `conversational-flow.tsx` | Q&A guided interface |
| `swipe-flow.tsx` | Card-stack rapid entry |
| `photo-capture-flow.tsx` | Multi-angle photo capture |
| `photo-capture-overlay.tsx` | Full-screen photo capture |
| `photo-grid.tsx` | Drag-reorderable photo grid |
| `crop-tool.tsx` | Interactive crop/rotate canvas |
| `recognition-fork.tsx` | Multi-candidate disambiguation |
| `pricing-strategy-picker.tsx` | Three-option pricing selector |
| `shipping-config-card.tsx` | Package dimensions and weight |
| `fee-estimate.tsx` | Marketplace fee breakdown |
| `publish-success.tsx` | Confetti success state |

Photo editing (rotate, crop, exposure, enhance, BG removal) lives in `components/capture/` as `photo-edit-overlay.tsx` and `photo-edit-panel.tsx`, shared with the scan flow.
