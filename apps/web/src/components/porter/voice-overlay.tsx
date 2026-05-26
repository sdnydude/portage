"use client";

import { useEffect, useRef } from "react";

type OverlayState = "listening" | "transcribing" | "processing";

interface VoiceOverlayProps {
  state: OverlayState;
  transcript?: string;
  onCancel: () => void;
  onSend: (text: string) => void;
}

const BARS = 15;

export function VoiceOverlay({ state, transcript, onCancel, onSend }: VoiceOverlayProps) {
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state === "transcribing" && editRef.current) {
      editRef.current.focus();
    }
  }, [state]);

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8">
      {/* State A: Listening */}
      {state === "listening" && (
        <>
          {/* Waveform bars */}
          <div className="flex h-16 items-end gap-1">
            {Array.from({ length: BARS }, (_, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-[var(--forest-green)]"
                style={{
                  height: "100%",
                  transformOrigin: "bottom",
                  animation: `waveform-bar 0.8s ease-in-out ${(i * 0.05).toFixed(2)}s infinite`,
                }}
              />
            ))}
          </div>
          <p className="text-sm text-[var(--muted)]">Listening…</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* State B: Transcribing / edit */}
      {state === "transcribing" && (
        <>
          <textarea
            ref={editRef}
            defaultValue={transcript ?? ""}
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--forest-green)]"
          />
          <div className="flex w-full gap-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-full border border-[var(--border)] py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={() => onSend(editRef.current?.value ?? transcript ?? "")}
              className="flex-1 rounded-full bg-[var(--forest-green)] py-2 text-sm text-white hover:opacity-90"
            >
              Send
            </button>
          </div>
        </>
      )}

      {/* State C: Processing */}
      {state === "processing" && (
        <>
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--forest-green)] border-t-transparent" />
          <p className="text-sm text-[var(--muted)]">Porter is working…</p>
          {transcript && (
            <div className="w-full rounded-xl bg-[var(--forest-green)] px-4 py-2 text-sm text-white">
              {transcript}
            </div>
          )}
        </>
      )}
    </div>
  );
}
