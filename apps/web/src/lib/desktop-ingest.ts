import type { RecognitionCandidate } from "@portage/shared";

// A lean POST /items body for batch ingest — core identified fields + photos.
// Category resolution, aspects, and shipping specifics are left to the normal
// item edit surface (this is quick-add, not the full scan-flow prepare path).
export interface IngestItemBody {
  title: string;
  description?: string;
  category?: string;
  condition?: RecognitionCandidate["condition"];
  conditionNotes?: string;
  brand?: string;
  model?: string;
  features?: string[];
  aspects?: Record<string, string[]>;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  aiConfidenceScore?: number;
  photos: { url: string; isPrimary: boolean }[];
}

const CONDITION_NOTES_MAX = 500; // server cap — over-length 400s the create

export function candidateToItemBody(
  fields: RecognitionCandidate,
  uploadedUrls: string[],
): IngestItemBody {
  return {
    title: fields.name,
    description: fields.description || undefined,
    category: fields.category || undefined,
    condition: fields.condition,
    conditionNotes: fields.conditionNotes
      ? fields.conditionNotes.slice(0, CONDITION_NOTES_MAX)
      : undefined,
    brand: fields.brand ?? undefined,
    model: fields.model ?? undefined,
    features: fields.features,
    aspects: fields.aspects,
    estimatedValueMin: fields.estimatedValueLow,
    estimatedValueMax: fields.estimatedValueHigh,
    aiConfidenceScore: fields.confidence,
    photos: uploadedUrls.map((url, i) => ({ url, isPrimary: i === 0 })),
  };
}

// Desktop drag-drop ingest (Phase R2). Mirrors the server's accepted upload
// types (apps/api/src/routes/images.ts ALLOWED_TYPES) so we reject
// non-images at the drop boundary instead of round-tripping to a 400.
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export interface PartitionedFiles {
  accepted: File[];
  rejected: File[];
}

// Per-drop grouping (Phase R2 fork — user chooses at drop time):
//  - "separate": each file becomes its own candidate item (opt-in merge later)
//  - "single":   the whole drop becomes one multi-photo item
export type IngestGroupingMode = "separate" | "single";

export function groupFilesIntoItems(
  files: File[],
  mode: IngestGroupingMode,
): File[][] {
  if (mode === "single") {
    return files.length > 0 ? [files] : [];
  }
  return files.map((file) => [file]);
}

export function partitionDroppedFiles(files: File[]): PartitionedFiles {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const file of files) {
    if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { accepted, rejected };
}
