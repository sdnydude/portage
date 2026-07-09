"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  published: boolean;
}

export function FaqSection() {
  const { token } = useAuth();
  const [faqList, setFaqList] = useState<AdminFaq[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = list mode; "new" = creating; otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [draftQ, setDraftQ] = useState("");
  const [draftA, setDraftA] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ faqs: AdminFaq[] }>("/admin/faqs", { token: token! });
      setFaqList(data.faqs);
    } catch {
      setError("Couldn't load FAQs");
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const startEdit = (faq: AdminFaq | null) => {
    setEditing(faq ? faq.id : "new");
    setDraftQ(faq?.question ?? "");
    setDraftA(faq?.answer ?? "");
    setError(null);
  };

  const save = async () => {
    if (!draftQ.trim() || !draftA.trim()) {
      setError("Question and answer are both required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") {
        await api("/admin/faqs", {
          method: "POST",
          body: { question: draftQ.trim(), answer: draftA.trim(), sortOrder: faqList?.length ?? 0 },
          token: token!,
        });
      } else {
        await api(`/admin/faqs/${editing}`, {
          method: "PATCH",
          body: { question: draftQ.trim(), answer: draftA.trim() },
          token: token!,
        });
      }
      setEditing(null);
      await load();
    } catch {
      setError("Save failed — try again");
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (faq: AdminFaq) => {
    setBusy(true);
    try {
      await api(`/admin/faqs/${faq.id}`, { method: "PATCH", body: { published: !faq.published }, token: token! });
      await load();
    } catch {
      setError("Update failed — try again");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (faq: AdminFaq) => {
    if (!window.confirm(`Delete "${faq.question}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api(`/admin/faqs/${faq.id}`, { method: "DELETE", token: token! });
      await load();
    } catch {
      setError("Delete failed — try again");
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!faqList) return;
    const target = index + dir;
    if (target < 0 || target >= faqList.length) return;
    const ids = faqList.map((f) => f.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      await api("/admin/faqs/reorder", { method: "PUT", body: { ids }, token: token! });
      await load();
    } catch {
      setError("Reorder failed — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Help FAQs</h2>
        {editing === null && (
          <button
            onClick={() => startEdit(null)}
            className="text-xs font-medium text-forest-green hover:underline"
          >
            + Add FAQ
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>
      )}

      {editing !== null ? (
        <div className="space-y-2">
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Question"
            maxLength={500}
            className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none"
          />
          <textarea
            value={draftA}
            onChange={(e) => setDraftA(e.target.value)}
            placeholder="Answer"
            maxLength={5000}
            rows={4}
            className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-text-primary border border-transparent focus:border-border-focus focus:outline-none resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(null)}
              disabled={busy}
              className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 py-2 rounded-xl bg-forest-green text-white text-xs font-medium disabled:opacity-50"
            >
              {busy ? "Saving…" : editing === "new" ? "Add FAQ" : "Save changes"}
            </button>
          </div>
        </div>
      ) : faqList === null ? (
        <p className="text-xs text-text-secondary">Loading…</p>
      ) : faqList.length === 0 ? (
        <p className="text-xs text-text-secondary">No FAQs yet — add the first one.</p>
      ) : (
        <ul className="space-y-1.5">
          {faqList.map((faq, i) => (
            <li key={faq.id} className="flex items-start gap-2 py-1.5 border-b border-border/60 last:border-b-0">
              <div className="flex flex-col gap-0.5 pt-0.5">
                <button
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  aria-label={`Move "${faq.question}" up`}
                  className="text-text-placeholder disabled:opacity-30 leading-none"
                >▲</button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={busy || i === faqList.length - 1}
                  aria-label={`Move "${faq.question}" down`}
                  className="text-text-placeholder disabled:opacity-30 leading-none"
                >▼</button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{faq.question}</p>
                <p className="text-xs text-text-secondary truncate">{faq.answer}</p>
              </div>
              {!faq.published && (
                <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-text-secondary shrink-0 mt-0.5">
                  Hidden
                </span>
              )}
              <div className="flex gap-2 shrink-0 mt-0.5">
                <button
                  onClick={() => togglePublished(faq)}
                  disabled={busy}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  {faq.published ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => startEdit(faq)}
                  disabled={busy}
                  className="text-xs text-forest-green hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(faq)}
                  disabled={busy}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
