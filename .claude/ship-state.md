status: in_progress
phase: 3
feature: Unified photo capture + editing flow with multi-photo scan, inline toolbar, comp field copying
approach: Capture-first (1-3+ photos before scan), multi-image AI analysis, inline editing toolbar on review screen, optional rescan, comp field adoption on item detail
complexity: complex
tdd: yes

completed:
  - task_1: iOS zoom fix + ItemPhoto type (commit 5665508)

plan:
  task_2: Multi-image scan API — update POST /scan for upload.array, add identifyItemsMulti in vision.ts
  task_3: POST /scan/refine endpoint — accepts imageUrls, uses fetchPhotosAsBase64 + analyzeImages
  task_4: ScanFlow Part A — capture-first phase, collect photos, horizontal strip, scan button
  task_5: ScanFlow Part B — review phase, inline editing toolbar, photo strip, rescan, save
  task_6: Item detail — Add Photos button + comp field copying (Use Title / Use Condition)
  task_7: Sweep text-sm → text-base on form inputs (login, register, search, settings)
  task_8: Build, deploy, verify end-to-end

deploy_order: shared (done) → api (tasks 2-3) → web (tasks 4-7) → deploy (task 8)

file_map:
  modify:
    - apps/api/src/lib/vision.ts: Add identifyItemsMulti, export fetchPhotosAsBase64
    - apps/api/src/routes/scan.ts: upload.array + /refine endpoint
    - apps/web/src/components/capture/scan-flow.tsx: Full rewrite (capture-first + toolbar + multi-photo)
    - apps/web/src/app/inventory/[id]/page.tsx: Add Photos + comp field copying
    - apps/web/src/app/login/page.tsx: text-sm → text-base on inputs
    - apps/web/src/app/register/page.tsx: text-sm → text-base on inputs
    - apps/web/src/components/inventory/search-bar.tsx: text-sm → text-base
    - apps/web/src/components/listing/create-listing-sheet.tsx: text-sm → text-base
  reuse:
    - apps/web/src/components/listing-flow/photo-editor.tsx: Icon components, tool patterns
    - apps/web/src/components/listing-flow/crop-tool.tsx: CropTool overlay
    - apps/web/src/hooks/use-enhance.ts: Enhance hook
    - apps/web/src/hooks/use-bg-removal.ts: BG removal hook
    - apps/web/src/components/capture/image-picker.tsx: Multi-file gallery picker
    - apps/api/src/lib/ai-client.ts: analyzeImages function (already exists)
  test:
    - apps/api/src/routes/__tests__/scan.test.ts: Multi-image scan + refine tests
    - apps/api/src/lib/__tests__/vision.test.ts: identifyItemsMulti tests

surprises:
  - analyzeImages already exists in ai-client.ts but wasn't wired to /scan
  - fetchPhotosAsBase64 exists but is private — needs export
  - identifyItemDetailed already returns candidates + reasoning — perfect for multi-image
  - No API changes were originally planned — now adding 2 endpoint changes
  - CompListing has no description field — copy limited to title + condition

decisions:
  - Capture-first flow (take 2-3 photos, then scan) over scan-on-first-photo
  - Use identifyItemDetailed (candidates + reasoning) for multi-image, not identifyItem (single result)
  - POST /scan/refine takes URLs not files — avoids re-uploading from R2
  - Rescan costs 1 scan credit (user approved)
  - Minimum 1 photo to scan, recommend 2+, send up to 3 to vision
  - Admin pages excluded from text-sm sweep (desktop-only)
