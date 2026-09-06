"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Height ceiling in px; past it the textarea scrolls instead of growing. */
  maxHeight?: number;
}

/**
 * A textarea whose height follows its content (the AI now writes 60–160 word
 * descriptions and multi-line condition notes; a fixed 5-row box hid most of
 * it, and iOS shows no resize handle). Grows on mount and on every value
 * change up to `maxHeight`, then scrolls. `rows` still sets the minimum.
 */
export function AutoGrowTextarea({ maxHeight = 480, className = "", ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Controlled component: every keystroke and every programmatic fill (AI
  // result, rescan) arrives as a new `value`, so one fit per value is enough.
  // With height:auto the box is `rows` tall, and scrollHeight is never below
  // that, so `rows` stays the floor.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [props.value, maxHeight]);

  return <textarea ref={ref} {...props} className={`${className} resize-none`} />;
}
