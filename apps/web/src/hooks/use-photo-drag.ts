"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";

export interface UsePhotoDragOptions {
  /** Live visual reorder — fires each time the dragged item passes over a new
   *  position. Hosts splice local state here; nothing is persisted yet. */
  onMove: (from: number, to: number) => void;
  /** Gesture ended after at least one move — the commit/persist point. */
  onDrop?: () => void;
  /** Short press-and-release without a drag. Hosts route tap-to-edit through
   *  this instead of their own onClick so post-drag clicks can't misfire. */
  onTap?: (index: number) => void;
  /** Return true to make an item inert (e.g. a still-uploading blob: thumb). */
  disabled?: (index: number) => boolean;
  longPressMs?: number;
}

export interface PhotoDragItemProps {
  "data-photo-drag-index": number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface UsePhotoDragResult {
  dragIndex: number | null;
  isDragging: boolean;
  getItemProps: (index: number) => PhotoDragItemProps;
}

const DEFAULT_LONG_PRESS_MS = 500;
// Finger travel (px) allowed while the long-press timer is pending; beyond
// this the gesture is a scroll, not a press, and the pending drag is dropped.
const PRE_ACTIVATION_TOLERANCE_PX = 10;
// Mouse drags activate on travel, not hold — anything past a click-wobble.
const MOUSE_ACTIVATION_PX = 5;

export function usePhotoDrag(options: UsePhotoDragOptions): UsePhotoDragResult {
  const { longPressMs = DEFAULT_LONG_PRESS_MS } = options;
  // Hosts pass inline callbacks; a ref keeps handlers fresh without
  // rebuilding getItemProps (and re-rendering every tile) each render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref mirror of dragIndex: on touch, every pointer event fires on the
  // pressed element (implicit capture), so handlers need capture-free state.
  const dragIndexRef = useRef<number | null>(null);
  // Press origin for the scroll-wins tolerance check (see onPointerMove).
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);
  // Pending press bookkeeping for the mouse fast path: which tile is pressed
  // and with what pointer type (mouse activates on distance, touch on hold).
  const pressIndexRef = useRef<number | null>(null);
  const pressPointerTypeRef = useRef<string>("");

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // While a drag is active, block native scroll. React registers touch
  // handlers passively, so preventDefault must go through a manual
  // non-passive document listener (same approach as dnd-kit's TouchSensor).
  const isDragging = dragIndex !== null;
  useEffect(() => {
    if (!isDragging) return;
    const blockScroll = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => document.removeEventListener("touchmove", blockScroll);
  }, [isDragging]);

  const endDrag = useCallback(() => {
    clearTimer();
    dragIndexRef.current = null;
    setDragIndex(null);
  }, [clearTimer]);

  const getItemProps = useCallback(
    (index: number): PhotoDragItemProps => ({
      "data-photo-drag-index": index,
      onPointerDown: (e) => {
        // Nested interactive children (delete ✕, etc.) opt out of the drag
        // gesture entirely — their own click handlers own the interaction.
        if ((e.target as Element).closest("[data-photo-drag-ignore]")) return;
        if (optionsRef.current.disabled?.(index)) return;
        clearTimer();
        pressOriginRef.current = { x: e.clientX, y: e.clientY };
        pressIndexRef.current = index;
        pressPointerTypeRef.current = e.pointerType;
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          dragIndexRef.current = index;
          setDragIndex(index);
        }, longPressMs);
      },
      onPointerMove: (e) => {
        // While the press is pending, movement means opposite things by
        // pointer type: a mouse drags immediately (desktop press-and-drag,
        // no hold-still habit); a finger that travels is a native scroll.
        if (timerRef.current !== null && pressOriginRef.current) {
          const dx = e.clientX - pressOriginRef.current.x;
          const dy = e.clientY - pressOriginRef.current.y;
          const dist = Math.hypot(dx, dy);
          if (pressPointerTypeRef.current === "mouse") {
            if (dist > MOUSE_ACTIVATION_PX && e.buttons & 1 && pressIndexRef.current !== null) {
              clearTimer();
              dragIndexRef.current = pressIndexRef.current;
              setDragIndex(pressIndexRef.current);
              // fall through: this same move may already hover a drop target
            } else {
              return;
            }
          } else {
            if (dist > PRE_ACTIVATION_TOLERANCE_PX) clearTimer();
            return;
          }
        }
        const from = dragIndexRef.current;
        if (from === null) return;
        // Touch keeps every event on the pressed element (implicit capture),
        // so drop targets are found by hit-testing the pointer position.
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-photo-drag-index]");
        if (!target) return;
        const to = Number(target.getAttribute("data-photo-drag-index"));
        if (Number.isNaN(to) || to === from) return;
        if (optionsRef.current.disabled?.(to)) return;
        optionsRef.current.onMove(from, to);
        dragIndexRef.current = to;
        setDragIndex(to);
      },
      onPointerUp: () => {
        // Timer still pending = the press never became a drag → it's a tap.
        const wasTap = timerRef.current !== null;
        const wasDragging = dragIndexRef.current !== null;
        endDrag();
        if (wasTap) optionsRef.current.onTap?.(index);
        else if (wasDragging) optionsRef.current.onDrop?.();
      },
      onPointerCancel: () => {
        endDrag();
      },
      // iOS fires the image save/copy callout (and Android a context menu) on
      // the same long-press that arms the drag — the menu wins and the drag
      // never starts. CSS -webkit-touch-callout handles Safari's callout;
      // this covers the contextmenu event path.
      onContextMenu: (e) => {
        e.preventDefault();
      },
    }),
    [clearTimer, endDrag, longPressMs],
  );

  return { dragIndex, isDragging, getItemProps };
}
