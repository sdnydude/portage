status: in_progress
phase: 6
feature: WebP → JPEG image format — fix marketplace compatibility
approach: |
  Switch all Sharp image processing from .webp() to .jpeg() in image.ts.
  Update content-type and extension references in upload routes.
  Background removal stays PNG (alpha transparency).
  No schema changes, no adapter changes needed.
complexity: simple
tdd: no

commits:
  - "4c75edc — fix: switch image pipeline from WebP to JPEG for marketplace compatibility"

review:
  agents: 6 (silent-failure-hunter, type-design-analyzer, code-reviewer, comment-analyzer, pr-test-analyzer, code-simplifier)
  critical_found: 0
  important_found: 3
  important_fixed: 3
  fixes:
    - "Restored WebP branch in remove-bg ternary for legacy R2 images"
    - "Fixed 'photo.webp' → 'photo.jpg' in use-listing-flow.ts (missed reference)"
    - "Collapsed redundant ternary (two identical branches)"
  minor_deferred: 5

verification:
  typecheck: pass (all 3 workspaces)
  tests: 93/93 pass (12 files)

deferred:
  - "image.test.ts — processImage/enhanceImage/rotateImage/cropImage/generateThumbnail have no direct tests"
  - "ProcessedImage.format should be a literal union type, not string"
  - "fetchPhotosAsBase64 silent content-type fallback (no log when header absent)"
  - "scan.ts R2 upload catch block loses userId + conflates Sharp/R2 errors"
  - "Suggested comments on ALLOWED_TYPES/SUPPORTED_TYPES for WebP input acceptance"
