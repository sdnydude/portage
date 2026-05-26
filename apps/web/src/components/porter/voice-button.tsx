"use client";

import { useVoiceInput } from "@/hooks/use-voice-input";
import { useAuth } from "@/hooks/use-auth";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
}

export function VoiceButton({ onTranscript }: VoiceButtonProps) {
  const { token } = useAuth();
  const { state, transcript, start, stop, reset } = useVoiceInput();

  const handleClick = async () => {
    if (state === "idle" || state === "done") {
      reset();
      if (token) await start(token);
    } else if (state === "listening") {
      stop();
    }
  };

  // When transcription completes, forward the result
  if (state === "done" && transcript) {
    onTranscript(transcript);
    reset();
  }

  const isListening = state === "listening";
  const isTranscribing = state === "transcribing";

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings when listening */}
      {isListening && (
        <>
          <span className="absolute h-12 w-12 rounded-full bg-[var(--forest-green)] opacity-0 animate-[pulse-ring_1.2s_ease-out_infinite]" />
          <span className="absolute h-12 w-12 rounded-full bg-[var(--forest-green)] opacity-0 animate-[pulse-ring_1.2s_ease-out_0.4s_infinite]" />
        </>
      )}
      <button
        onClick={handleClick}
        disabled={isTranscribing}
        aria-label={isListening ? "Stop recording" : "Start voice input"}
        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          isListening
            ? "bg-red-500 text-white"
            : isTranscribing
            ? "bg-[var(--muted-bg)] text-[var(--muted)]"
            : "bg-[var(--forest-green)] text-white hover:opacity-90"
        }`}
      >
        {isTranscribing ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
            <path strokeLinecap="round" d="M19 10a7 7 0 0 1-14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>
    </div>
  );
}
