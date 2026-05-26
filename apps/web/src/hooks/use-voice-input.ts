"use client";

import { useState, useCallback, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type VoiceState = "idle" | "listening" | "transcribing" | "done";

export interface VoiceInputState {
  state: VoiceState;
  transcript: string | null;
  error: string | null;
  start: (token: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 2000;

export function useVoiceInput(): VoiceInputState {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string>("");

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    setVoiceState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch(`${API_BASE}/porter/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        body: form,
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = (await res.json()) as { text: string };
      setTranscript(data.text);
      setVoiceState("done");
    } catch {
      setError("Transcription failed");
      setVoiceState("idle");
    }
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
  }, [stopTracks]);

  const start = useCallback(async (token: string) => {
    setError(null);
    setTranscript(null);
    tokenRef.current = token;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied");
      return;
    }
    streamRef.current = stream;

    // Silence detection via Web Audio API
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);

    const checkSilence = () => {
      analyser.getFloatTimeDomainData(buffer);
      const amplitude = Math.max(...buffer.map(Math.abs));
      if (amplitude < SILENCE_THRESHOLD) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            stop();
          }, SILENCE_DURATION_MS);
        }
      } else {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
      if (mediaRecorderRef.current?.state === "recording") {
        requestAnimationFrame(checkSilence);
      }
    };

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stopTracks();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      transcribeBlob(blob);
    };

    recorder.start(100);
    setVoiceState("listening");
    requestAnimationFrame(checkSilence);
  }, [stop, stopTracks, transcribeBlob]);

  const reset = useCallback(() => {
    stop();
    setVoiceState("idle");
    setTranscript(null);
    setError(null);
  }, [stop]);

  return { state: voiceState, transcript, error, start, stop, reset };
}
