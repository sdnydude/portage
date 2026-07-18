"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

// Manages the Cloudflare Access email allowlist — the beta signup gate lives
// at the edge, so adding an email here is what lets a tester in.
export function AllowlistSection() {
  const { token, user } = useAuth();
  const [emails, setEmails] = useState<string[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<{ emails: string[] }>("/admin/allowlist", { token });
      setEmails(data.emails);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the allowlist");
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newEmail.trim() || busy) return;
    setBusy(true);
    try {
      const data = await api<{ emails: string[]; invited: boolean }>("/admin/allowlist", {
        method: "POST",
        token,
        body: { email: newEmail.trim() },
      });
      setEmails(data.emails);
      setError(data.invited ? null : `Added to the allowlist, but the invite email could not be sent — use Resend invite to retry.`);
      setNewEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the email");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async (email: string) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      // POST is idempotent on the allowlist (already present) and re-fires the
      // invite email — the same path new adds take.
      const data = await api<{ emails: string[]; invited: boolean }>("/admin/allowlist", {
        method: "POST",
        token,
        body: { email },
      });
      setEmails(data.emails);
      setError(data.invited ? null : `Added, but the invite email to ${email} could not be sent.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend the invite");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!token || busy) return;
    if (!confirm(`Remove ${email} from the beta allowlist? They will lose access at the edge.`)) return;
    setBusy(true);
    try {
      const data = await api<{ emails: string[] }>(`/admin/allowlist/${encodeURIComponent(email)}`, {
        method: "DELETE",
        token,
      });
      setEmails(data.emails);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-1">Beta Access Allowlist</h2>
      <p className="text-xs text-text-placeholder mb-3">
        Emails allowed through Cloudflare Access. Adding an email lets a tester sign in and sends them an invite; removing it blocks them at the edge.
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 mb-3 text-xs text-red-700">{error}</div>
      )}

      {emails === null ? (
        <div className="h-20 bg-muted rounded animate-pulse" />
      ) : (
        <ul className="mb-3">
          {emails.map((email) => (
            <li key={email} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm text-text-primary">{email}</span>
              {email.toLowerCase() === user?.email.toLowerCase() ? (
                <span className="text-xs text-text-placeholder">you</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResend(email)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 disabled:opacity-50"
                  >
                    Resend invite
                  </button>
                  <button
                    onClick={() => handleRemove(email)}
                    disabled={busy}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
          {emails.length === 0 && (
            <li className="py-2 text-sm text-text-placeholder">No emails on the allowlist yet.</li>
          )}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="tester@example.com"
          aria-label="Email to allow"
          className="flex-1 px-2 py-1.5 bg-muted rounded text-sm text-text-primary border border-border"
        />
        <button
          type="submit"
          disabled={busy || !newEmail.trim()}
          className="text-xs px-3 py-1.5 rounded bg-forest-green text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
