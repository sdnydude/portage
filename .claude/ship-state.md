status: in_progress
phase: 2
feature: Unified photo capture + editing flow with multi-photo and comp field adoption
approach: Merge PhotoEditor into ScanFlow review screen, add multi-photo (up to 12), add comp field copying on item detail page
complexity: complex

file_map:
  modify:
    - scan-flow.tsx: Add photo editing toolbar to review, multi-photo strip, upload additional photos
    - image-picker.tsx: Pass multiple=true from ScanFlow
    - inventory/[id]/page.tsx: Comp field copying, add photos button
    - shared/types.ts: Fix Item.photos type from string[] to ItemPhoto[]
  reuse:
    - photo-editor.tsx: PhotoEditor component (rotate/crop/enhance/BG remove)
    - photo-capture-flow.tsx: uploadBlob pattern, CapturedPhoto interface
    - use-enhance.ts, use-bg-removal.ts: Editing hooks
    - use-item.ts: updateItem(PATCH) for saving photos
    - API routes: No changes needed (PATCH /items/:id, POST /images, POST /scan all exist)

surprises:
  - Item.photos type is string[] in shared but runtime is ItemPhoto[] — type bug to fix
  - CompListing has no description field — can copy title + condition only
  - No API changes needed — all endpoints exist
