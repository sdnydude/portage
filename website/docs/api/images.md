---
id: images
title: Images
sidebar_position: 2
---

# Images

Upload, enhance, and process item photos. Images are stored in Cloudflare R2.

## Endpoints

### Upload Image

```
POST /images
```

**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Body:** Form data with `image` field containing the file.

**Response** `201`:

```json
{
  "image": {
    "key": "items/uuid/2026/07/17/a1b2c3.jpg",
    "url": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/a1b2c3.jpg",
    "width": 2048,
    "height": 2048,
    "size": 524288
  },
  "thumbnail": {
    "key": "items/uuid/2026/07/17/b2c3d4_thumb.jpg",
    "url": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/b2c3d4_thumb.jpg"
  }
}
```

### Enhance Image

```
POST /images/enhance
```

**Auth:** Required

Server-side auto-enhancement via Sharp (auto-level, sharpen, color correction). A batch variant, `POST /images/batch-enhance`, enhances multiple `imageUrls` in one call.

**Body:**

```json
{
  "imageUrl": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/a1b2c3.jpg"
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/2026/07/17/c3d4e5_enhanced.jpg",
    "url": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/c3d4e5_enhanced.jpg",
    "width": 2048,
    "height": 2048,
    "size": 498000
  }
}
```

### Remove Background

```
POST /images/remove-bg
```

**Auth:** Required

Background removal is handled **server-side** by the `portage-rembg` container (reached via `REMBG_URL`, model `isnet-general-use`). The transparent cutout is flattened onto a white background (eBay's preferred background) and re-uploaded as a JPEG. Billing-gated per tier — see [Billing Gates](#billing-gates).

**Body:**

```json
{
  "imageUrl": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/a1b2c3.jpg"
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/2026/07/17/d4e5f6_nobg.jpg",
    "url": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/d4e5f6_nobg.jpg",
    "size": 412000
  }
}
```

**Errors:** `400 INVALID_ORIGIN` (URL not from Portage storage), `400 FETCH_FAILED` (source image could not be fetched), `400 FILE_TOO_LARGE` (over the 20 MB fetch limit), `429 BG_REMOVAL_LIMIT_REACHED` (monthly limit), `502 BG_REMOVAL_FAILED` (rembg service error — no credit is deducted).

The same `INVALID_ORIGIN` / `FETCH_FAILED` / `FILE_TOO_LARGE` codes apply to all URL-based image endpoints (enhance, rotate, exposure, crop). A URL passes the origin check only when it starts with the configured `R2_PUBLIC_URL` or with `https://portage-images.digitalharmonyai.com/` — everything else is rejected with `INVALID_ORIGIN`.

### Rotate Image

```
POST /images/rotate
```

**Auth:** Required

Rotates an image by the specified degrees (90, 180, 270).

**Body:**

```json
{
  "imageUrl": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/a1b2c3.jpg",
  "degrees": 90
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/2026/07/17/e5f6a7_rotated.jpg",
    "url": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/e5f6a7_rotated.jpg",
    "width": 2048,
    "height": 2048
  }
}
```

### Adjust Exposure

```
POST /images/exposure
```

**Auth:** Required

Adjusts exposure by an EV value between -2 and +2.

**Body:**

```json
{
  "imageUrl": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/a1b2c3.jpg",
  "ev": 0.5
}
```

### Crop Image

```
POST /images/crop
```

**Auth:** Required

Crops an image to the specified rectangle (pixel coordinates).

**Body:**

```json
{
  "imageUrl": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/a1b2c3.jpg",
  "crop": { "x": 100, "y": 50, "width": 800, "height": 800 }
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/2026/07/17/f6a7b8_cropped.jpg",
    "url": "https://portage-images.digitalharmonyai.com/items/uuid/2026/07/17/f6a7b8_cropped.jpg",
    "width": 800,
    "height": 800
  }
}
```

### Fetch Image (authenticated proxy)

```
GET /images/r2/*path
```

**Auth:** Required (owner only)

Streams an R2 object through the API. The wildcard path is the R2 object key and must start with `items/{userId}/` — keys belonging to another user return `403 FORBIDDEN`. Responses are served with `Cache-Control: public, max-age=31536000, immutable`.

### Delete Image

```
DELETE /images?key=<key>
```

**Auth:** Required (owner only)

Deletes an image from storage. The R2 object key is passed as the `key` **query parameter** and must start with `items/{userId}/`.

**Response** `200`: `{ "deleted": true }`

**Errors:** `400 MISSING_KEY`, `403 FORBIDDEN` (key belongs to another user).

## Billing Gates

Background removal is gated by the user's effective subscription tier:

- **Free tier:** Limited monthly uses (idempotent reset on billing cycle)
- **Pro / beta-tester tier:** Unlimited uses

The API returns `429` with `code: "BG_REMOVAL_LIMIT_REACHED"` when the limit is exceeded. Usage is deducted only after a successful removal.

## Storage

Images are stored in **Cloudflare R2** (S3-compatible object storage):

- **Bucket:** `portage-images`
- **Public URL:** Configured via `R2_PUBLIC_URL` environment variable
- **CDN:** R2 includes built-in CDN with custom domain support

### Image Key Format

```
items/{userId}/{yyyy}/{mm}/{dd}/{uuid}{suffix}
```

Every upload — including each processed result — gets a **fresh** key (upload date + random UUID); derived images are new objects, not renamed variants of the source. The suffix identifies the operation: `_thumb.jpg`, `_enhanced.jpg`, `_nobg.jpg`, `_rotated.jpg`, `_cropped.jpg`, `_exposure.jpg`.

### Photo Object Shape

```typescript
interface ItemPhoto {
  url: string;      // Public R2 URL
  key: string;      // R2 object key
  width?: number;
  height?: number;
  isPrimary?: boolean;
}
```

`width`, `height`, and `isPrimary` are optional — only `url` and `key` are guaranteed on every photo.

Items store photos as a JSONB array, allowing multiple photos per item (up to 24 — `MAX_PHOTOS_PER_ITEM`).
