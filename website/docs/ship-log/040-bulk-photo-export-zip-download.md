---
id: 040-bulk-photo-export-zip-download
title: "#040 — Bulk Photo Export (ZIP Download)"
sidebar_label: "#040 Bulk Photo Export"
tags: [export, zip, photo, bulk, fflate]
---

# #040 — Bulk Photo Export (ZIP Download)

**Branch:** `feat/bulk-image-export` | **PR:** [#88](https://github.com/sdnydude/portage/pull/88) | **Status:** Complete

## What shipped

Inventory items can now export all their photos as a ZIP archive. From multi-select mode, tapping **Export** opens a bottom sheet with two options: **Download Photos (ZIP)** and **Export to eBay CSV**.

### New endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /items/photos/export/prepare` | JWT | Validates ownership, caps at 60 photos, generates a 5-min download token |
| `GET /items/photos/export?token=` | Token | Streams ZIP — no JWT required (safe for direct browser downloads) |

### Token design

A short-lived `export_tokens` row (5 min TTL, 3-use max) decouples authentication from the download URL. The 3-use cap handles iOS Safari's speculative GET pre-fetch without requiring server-side stream detection.

### ZIP streaming via fflate

`fflate`'s `Zip` class is used over `jszip` because it's ESM-native and doesn't require Buffer wrapping. Photos are added with `level: 0` (store, no compression — JPEGs don't compress further). All chunks are collected into a `Buffer[]` and flushed in one `res.end()` call, which allows Express to set `Content-Length` automatically — required for supertest binary assertions.

### SSRF protection

All photo URLs are validated against `isAllowedImageOrigin()` (R2 public URL or `https://portage-images.digitalharmonyai.com/`) before any fetch is made.

### Frontend

`ExportActionSheet` is a slide-up bottom sheet wired into the inventory page's `BulkActionBar`. It manages a state machine (idle → preparing → ready/error) and triggers the ZIP download via an anchor click after the prepare response arrives.

## Key decisions

- **Buffer-collect over streaming** — `res.end(Buffer.concat(chunks))` ensures `Content-Length` is set, which supertest needs for binary content assertions (`Number(res.headers['content-length']) > 22`).
- **res.setHeader after ZIP assembly** — headers must be set after potential error conditions. If `Content-Type: application/zip` is set before an error is thrown, `res.json()` in the error handler won't override it (Express only sets Content-Type if it hasn't been set yet), leaving the body unparsed by supertest.
- **Route placed before requireAuth** — `GET /photos/export` is mounted before `itemsRouter.use(requireAuth)` so the token-based auth bypass works without middleware restructuring.

## Tests

290/292 passing. 9 new tests added across `items.test.ts` and `photo-export.test.ts`.

## Deferred

- SSRF regression test (no failing-fetch assertion)
- Per-photo server-side error logging
- `export_tokens` table cleanup job for expired rows
