"use client";

import { useCallback, useRef, useState } from "react";
import type { RecognitionCandidate } from "@portage/shared";
import { api, apiUpload } from "@/lib/api";
import { useAuth } from "./use-auth";
import {
  groupFilesIntoItems,
  candidateToItemBody,
  type IngestGroupingMode,
} from "@/lib/desktop-ingest";

// /scan/refine accepts at most 3 images per vision call (apps/api scan.ts).
const VISION_PHOTO_LIMIT = 3;

interface RefineResponse {
  identification: RecognitionCandidate;
  detailed: { candidates: RecognitionCandidate[]; reasoning: string[] };
}

export type IngestStatus =
  | "queued"
  | "uploading"
  | "identifying"
  | "ready"
  | "saving"
  | "saved"
  | "error";

export interface IngestItem {
  id: string;
  files: File[];
  status: IngestStatus;
  uploadedUrls: string[];
  fields?: RecognitionCandidate;
  error?: string;
}

/**
 * Desktop drag-drop ingest queue (Phase R2). Owns the per-item state machine:
 * queued → uploading → identifying → ready → saving → saved | error.
 * The upload/vision/save pipeline is layered on in later TDD cycles.
 */
export function useDesktopIngest() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<IngestItem[]>([]);
  const queueRef = useRef<IngestItem[]>([]);
  const idRef = useRef(0);

  // setQueue mirror — keeps queueRef current so async handlers (save) read the
  // latest item state instead of a stale closure.
  const commit = useCallback(
    (updater: (q: IngestItem[]) => IngestItem[]) => {
      setQueue((q) => {
        const next = updater(q);
        queueRef.current = next;
        return next;
      });
    },
    [],
  );

  const patch = useCallback(
    (id: string, next: Partial<IngestItem>) => {
      commit((q) => q.map((it) => (it.id === id ? { ...it, ...next } : it)));
    },
    [commit],
  );

  const process = useCallback(
    async (item: IngestItem) => {
      try {
        patch(item.id, { status: "uploading" });
        const urls: string[] = [];
        for (const file of item.files) {
          const form = new FormData();
          form.append("image", file);
          const res = await apiUpload<{ image: { url: string } }>(
            "/images",
            form,
            { token: token ?? undefined },
          );
          urls.push(res.image.url);
        }
        patch(item.id, { uploadedUrls: urls, status: "identifying" });
        const vision = await api<RefineResponse>("/scan/refine", {
          method: "POST",
          token: token ?? undefined,
          body: { imageUrls: urls.slice(0, VISION_PHOTO_LIMIT) },
        });
        const fields = vision.detailed.candidates[0] ?? vision.identification;
        patch(item.id, { status: "ready", fields });
      } catch (e) {
        patch(item.id, {
          status: "error",
          error: e instanceof Error ? e.message : "ingest failed",
        });
      }
    },
    [patch, token],
  );

  const addFiles = useCallback(
    (files: File[], mode: IngestGroupingMode) => {
      const groups = groupFilesIntoItems(files, mode);
      const items: IngestItem[] = groups.map((g) => ({
        id: `ingest-${idRef.current++}`,
        files: g,
        status: "queued",
        uploadedUrls: [],
      }));
      commit((q) => [...q, ...items]);
      items.forEach((it) => void process(it));
    },
    [commit, process],
  );

  const save = useCallback(
    async (id: string) => {
      const item = queueRef.current.find((it) => it.id === id);
      if (!item?.fields) return;
      patch(id, { status: "saving" });
      try {
        await api("/items", {
          method: "POST",
          token: token ?? undefined,
          body: candidateToItemBody(item.fields, item.uploadedUrls),
        });
        patch(id, { status: "saved" });
      } catch (e) {
        patch(id, {
          status: "error",
          error: e instanceof Error ? e.message : "save failed",
        });
      }
    },
    [patch, token],
  );

  const updateFields = useCallback(
    (id: string, next: Partial<RecognitionCandidate>) => {
      commit((q) =>
        q.map((it) =>
          it.id === id && it.fields
            ? { ...it, fields: { ...it.fields, ...next } }
            : it,
        ),
      );
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      commit((q) => q.filter((it) => it.id !== id));
    },
    [commit],
  );

  return { queue, addFiles, save, updateFields, remove };
}
