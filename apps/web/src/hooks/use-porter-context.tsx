"use client";

import { createContext, use, useMemo, useState } from "react";
import { usePorterStream, type PorterStreamState } from "./use-porter-stream";

interface PorterContextValue extends PorterStreamState {
  chatInput: string;
  setChatInput: (v: string) => void;
  isEngaged: boolean;
  setIsEngaged: (v: boolean) => void;
}

const PorterContext = createContext<PorterContextValue | null>(null);

export function PorterProvider({ children }: { children: React.ReactNode }) {
  const stream = usePorterStream();
  const [chatInput, setChatInput] = useState("");
  const [isEngaged, setIsEngaged] = useState(false);

  const value = useMemo(
    () => ({
      ...stream,
      chatInput,
      setChatInput,
      isEngaged,
      setIsEngaged,
    }),
    [stream, chatInput, isEngaged]
  );

  return <PorterContext value={value}>{children}</PorterContext>;
}

export function usePorter(): PorterContextValue {
  const ctx = use(PorterContext);
  if (!ctx) throw new Error("usePorter must be used inside PorterProvider");
  return ctx;
}
