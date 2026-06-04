"use client";

import { useState, useCallback, useRef } from "react";

import { API_BASE } from "@/lib/api";

export interface PorterAudioState {
  isPlaying: boolean;
  autoPlay: boolean;
  setAutoPlay: (v: boolean) => void;
  speak: (text: string, token: string) => Promise<void>;
  stop: () => void;
}

export function usePorterAudio(): PorterAudioState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    audioRef.current = null;
    setIsPlaying(false);
  }, []);

  const speak = useCallback(async (text: string, token: string) => {
    stop();
    try {
      const res = await fetch(`${API_BASE}/porter/speak`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return; // Graceful fallback: TTS unavailable
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
        audioRef.current = null;
        setIsPlaying(false);
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
      setIsPlaying(true);
    } catch {
      // Graceful fallback: ignore TTS failures, show text only
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, [stop]);

  return { isPlaying, autoPlay, setAutoPlay, speak, stop };
}
