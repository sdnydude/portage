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
    "key": "items/uuid/photo-1.jpg",
    "url": "https://images.portage.app/items/uuid/photo-1.jpg",
    "width": 2048,
    "height": 2048,
    "size": 524288
  },
  "thumbnail": {
    "key": "items/uuid/photo-1_thumb.jpg",
    "url": "https://images.portage.app/items/uuid/photo-1_thumb.jpg"
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
  "imageUrl": "https://images.portage.app/items/uuid/photo-1.jpg"
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/photo-1-enhanced.jpg",
    "url": "https://images.portage.app/items/uuid/photo-1-enhanced.jpg",
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

Background removal is handled **client-side** via `@imgly/background-removal` WASM module. This endpoint exists as a server-side fallback.

**Body:**

```json
{
  "imageUrl": "https://images.portage.app/items/uuid/photo-1.jpg"
}
```

### Rotate Image

```
POST /images/rotate
```

**Auth:** Required

Rotates an image by the specified degrees (90, 180, 270).

**Body:**

```json
{
  "imageUrl": "https://images.portage.app/items/uuid/photo-1.jpg",
  "degrees": 90
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/photo-1-rotated.jpg",
    "url": "https://images.portage.app/items/uuid/photo-1-rotated.jpg",
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
  "imageUrl": "https://images.portage.app/items/uuid/photo-1.jpg",
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
  "imageUrl": "https://images.portage.app/items/uuid/photo-1.jpg",
  "crop": { "x": 100, "y": 50, "width": 800, "height": 800 }
}
```

**Response** `200`:

```json
{
  "image": {
    "key": "items/uuid/photo-1-cropped.jpg",
    "url": "https://images.portage.app/items/uuid/photo-1-cropped.jpg",
    "width": 800,
    "height": 800
  }
}
```

### Delete Image

```
DELETE /images
```

**Auth:** Required (owner only)

Deletes an image from storage by its key.

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
items/{userId}/{filename}
```

### Photo Object Shape

```typescript
interface ItemPhoto {
  url: string;      // Public R2 URL
  key: string;      // R2 object key
  width: number;
  height: number;
  isPrimary: boolean;
}
```

Items store photos as a JSONB array, allowing multiple photos per item (up to 12).
