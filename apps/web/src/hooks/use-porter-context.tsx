"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePorterStream, type PorterStreamState } from "./use-porter-stream";
import { usePorterAudio, type PorterAudioState } from "./use-porter-audio";
import { useAuth } from "./use-auth";

interface PorterContextValue extends PorterStreamState {
  chatInput: string;
  setChatInput: (v: string) => void;
  isEngaged: boolean;
  setIsEngaged: (v: boolean) => void;
  autoPlay: boolean;
  toggleAutoPlay: () => void;
  audio: PorterAudioState;
}

const PorterContext = createContext<PorterContextValue | null>(null);

export function PorterProvider({ children }: { children: React.ReactNode }) {
  const stream = usePorterStream();
  const audio = usePorterAudio();
  const { token } = useAuth();
  const [chatInput, setChatInput] = useState("");
  const [isEngaged, setIsEngaged] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  const toggleAutoPlay = useCallback(() => setAutoPlay((v) => !v), []);

  // Exposed so callers can fire TTS after a stream completes
  const onPorterDone = useCallback((text: string) => {
    if (autoPlay && token) audio.speak(text, token);
  }, [autoPlay, token, audio]);

  // Patch sendMessage to auto-inject the onDone callback
  const sendMessage = useCallback(
    (message: string, onDone?: (text: string) => void) =>
      stream.sendMessage(message, onDone ?? onPorterDone),
    [stream, onPorterDone]
  );

  const value = useMemo(
    () => ({
      ...stream,
      sendMessage,
      chatInput,
      setChatInput,
      isEngaged,
      setIsEngaged,
      autoPlay,
      toggleAutoPlay,
      audio,
    }),
    [stream, sendMessage, chatInput, isEngaged, autoPlay, toggleAutoPlay, audio]
  );

  return <PorterContext.Provider value={value}>{children}</PorterContext.Provider>;
}

export function usePorter(): PorterContextValue {
  const ctx = useContext(PorterContext);
  if (!ctx) throw new Error("usePorter must be used inside PorterProvider");
  return ctx;
}
