"use client";

import { useState, useRef } from "react";

interface AudioPlaybackProps {
  audioUrl: string;
  duration?: number;
}

export function AudioPlayback({ audioUrl, duration }: AudioPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
    >
      {isPlaying ? (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-[var(--forest-green)]">
          <rect x="3" y="2" width="4" height="12" rx="1" />
          <rect x="9" y="2" width="4" height="12" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-[var(--forest-green)]">
          <path d="M4 2.5l10 5.5-10 5.5V2.5z" />
        </svg>
      )}
      <span className="text-[var(--forest-green)]">
        {isPlaying ? "Playing" : "Play response"}
      </span>
      {duration !== undefined && (
        <span className="font-jetbrains text-[var(--muted)]">{duration.toFixed(1)}s</span>
      )}
    </button>
  );
}
