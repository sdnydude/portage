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
  }
}
```

### Enhance Image

```
POST /images/enhance
```

**Auth:** Required

Server-side auto-enhancement via Sharp (auto-level, sharpen, color correction).

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
