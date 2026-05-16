"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "@/lib/api";

interface Comment {
  id: string;
  direction: string;
  stepNumber: number | null;
  comment: string;
  reviewerName: string | null;
  createdAt: string;
}

const API = `${API_BASE}/survey/comments`;

export function ReviewComments({ direction, currentStep }: { direction: string; currentStep: number }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [badge, setBadge] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`${API}/${direction}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.reverse());
        setBadge(data.length);
      }
    } catch { /* offline */ }
  }, [direction]);

  const handleSelection = useCallback(() => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    if (panelRef.current?.contains(sel.anchorNode)) return;
    const selected = sel.toString().trim();
    setOpen(true);
    loadComments();
    setText((prev) => {
      const quote = `"${selected.length > 120 ? selected.slice(0, 120) + "…" : selected}"\n\n`;
      return prev ? prev : quote;
    });
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [loadComments]);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("touchend", handleSelection);
    };
  }, [handleSelection]);

  useEffect(() => {
    const saved = localStorage.getItem("reviewer-name");
    if (saved) setName(saved);
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [comments, open]);

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    if (name.trim()) localStorage.setItem("reviewer-name", name.trim());
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          stepNumber: currentStep,
          comment: text.trim(),
          reviewerName: name.trim() || undefined,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setComments((prev) => [...prev, saved]);
        setBadge((b) => b + 1);
        setText("");
      }
    } catch { /* offline */ }
    setSending(false);
  }

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  function timeAgo(iso: string) {
    const ms = now - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const stepLabel = (n: number | null) => n !== null && n !== undefined ? `Step ${n}` : "";

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => { setOpen(!open); if (!open) loadComments(); }}
        className="fixed z-[60] bottom-6 right-6 w-14 h-14 rounded-full bg-[#0047AB] text-white shadow-lg flex items-center justify-center hover:bg-[#003380] active:scale-95 transition-all"
        style={{ boxShadow: "0 4px 20px rgba(0,71,171,0.4)" }}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        )}
        {!open && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#F15A22] text-white text-[11px] font-bold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[59] bottom-24 right-6 w-[340px] rounded-2xl bg-white border border-[#E8E5DE] shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "480px", animation: "fadeSlideUp 0.25s ease-out", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E8E5DE] bg-[#F8F7F4]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1A1A1A] font-[family-name:var(--font-instrument)]">Reviewer Comments</h3>
                <p className="text-[11px] text-[#8A8A8A]">{comments.length} comment{comments.length !== 1 ? "s" : ""} on {direction}</p>
              </div>
              <span className="text-[11px] text-[#0047AB] font-medium px-2 py-0.5 bg-[#0047AB]/8 rounded-full">Step {currentStep}</span>
            </div>
          </div>

          {/* Comments list */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: "120px", maxHeight: "280px" }}>
            {comments.length === 0 && (
              <p className="text-[13px] text-[#BCBCBC] text-center py-6">No comments yet. Be the first!</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="group">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-[#1A1A1A]">{c.reviewerName || "Anonymous"}</span>
                  {stepLabel(c.stepNumber) && (
                    <span className="text-[10px] text-[#0047AB] bg-[#0047AB]/8 px-1.5 py-0.5 rounded font-medium">{stepLabel(c.stepNumber)}</span>
                  )}
                  <span className="text-[10px] text-[#BCBCBC] ml-auto">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{c.comment}</p>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="border-t border-[#E8E5DE] px-4 py-3 bg-[#F8F7F4]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E8E5DE] text-[13px] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40 focus:outline-none mb-2"
            />
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Leave a comment about this screen..."
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-[#E8E5DE] text-[13px] text-[#1A1A1A] placeholder:text-[#BCBCBC] focus:border-[#0047AB]/40 focus:outline-none resize-none"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              />
              <button
                onClick={submit}
                disabled={!text.trim() || sending}
                className="self-end px-4 py-2 rounded-lg bg-[#F15A22] text-white text-[13px] font-medium disabled:opacity-40 hover:bg-[#d94e1c] active:scale-95 transition-all"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
