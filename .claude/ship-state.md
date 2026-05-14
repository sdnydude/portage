status: in_progress
phase: 2
feature: WebP → JPEG image format — fix marketplace compatibility
approach: |
  Switch all Sharp image processing from .webp() to .jpeg() in image.ts.
  Update content-type and extension references in upload routes.
  Background removal stays PNG (alpha transparency).
  No schema changes, no adapter changes needed.
complexity: simple
tdd: no
spec: |
  - Change all .webp() calls to .jpeg() in apps/api/src/lib/image.ts
  - Update content-type from image/webp to image/jpeg in upload routes
  - Update extensions from .webp to .jpg in upload routes
  - Update processImage return format from 'webp' to 'jpeg'
  - Update getImage default content-type fallback
  - Background removal stays PNG — no change
  - Existing WebP images in R2 unaffected (no migration)

file_map:
  modify:
    - apps/api/src/lib/image.ts (5x .webp→.jpeg, 4x format string)
    - apps/api/src/routes/images.ts (5x content-type, 5x extension)
    - apps/api/src/routes/scan.ts (2x content-type, 2x extension, 2x media type)
    - apps/api/src/lib/storage.ts (1x default content-type fallback)
    - apps/api/src/lib/vision.ts (1x default content-type fallback)
    - apps/api/src/lib/vision.test.ts (3x media type in assertions)
    - apps/api/src/routes/scan.test.ts (6x URL fixtures, 2x media type)
  unchanged:
    - remove-bg route (already PNG)
    - ALLOWED_TYPES (WebP still valid input)
    - all marketplace adapters (pass through R2 URLs)

surprises: none
