"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface UserProfile {
  email: string;
  displayName: string | null;
  subscriptionTier: string;
  address: Address | null;
  notificationPreferences: Record<string, boolean> | null;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState<Address>({
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!token) return;
    api<UserProfile>("/users/me", { token })
      .then((data) => {
        setProfile(data);
        setDisplayName(data.displayName || "");
        if (data.address) setAddress(data.address as Address);
      })
      .catch(() => setMessage({ text: "Failed to load profile", type: "error" }));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {};
      if (displayName !== (profile?.displayName || "")) body.displayName = displayName;
      const origAddr = profile?.address as Address | null;
      if (JSON.stringify(address) !== JSON.stringify(origAddr || { street1: "", street2: "", city: "", state: "", zip: "", country: "US" })) {
        body.address = (address.street1 || address.city) ? address : null;
      }

      if (Object.keys(body).length === 0) {
        setMessage({ text: "No changes to save", type: "success" });
        setSaving(false);
        return;
      }

      const updated = await api<UserProfile>("/users/me", {
        method: "PATCH",
        body,
        token,
      });
      setProfile(updated);
      setMessage({ text: "Profile updated", type: "success" });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ text: "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 content-container">
          <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Profile</h1>
        </div>
      </header>

      <div className="px-4 py-6 content-container space-y-6">
        {/* Email (read-only) */}
        <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
          <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
          <p className="text-sm text-text-primary">{profile?.email || "..."}</p>
        </div>

        {/* Tier */}
        <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
          <label className="block text-xs font-medium text-text-secondary mb-1">Plan</label>
          <p className="text-sm text-text-primary capitalize">{profile?.subscriptionTier || "..."}</p>
        </div>

        {/* Display Name */}
        <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: "var(--shadow-subtle)" }}>
          <label className="block text-xs font-medium text-text-secondary mb-2">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
          />
        </div>

        {/* Address */}
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-3" style={{ boxShadow: "var(--shadow-subtle)" }}>
          <label className="block text-xs font-medium text-text-secondary">Address</label>
          <input
            type="text"
            value={address.street1}
            onChange={(e) => setAddress((a) => ({ ...a, street1: e.target.value }))}
            placeholder="Street address"
            className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
          />
          <input
            type="text"
            value={address.street2 || ""}
            onChange={(e) => setAddress((a) => ({ ...a, street2: e.target.value }))}
            placeholder="Apt, suite, etc. (optional)"
            className="w-full px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
          />
          <div className="grid grid-cols-5 gap-2">
            <input
              type="text"
              value={address.city}
              onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
              placeholder="City"
              className="col-span-2 px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
            />
            <input
              type="text"
              value={address.state}
              onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
              placeholder="State"
              className="col-span-1 px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
            />
            <input
              type="text"
              value={address.zip}
              onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
              placeholder="ZIP"
              className="col-span-2 px-3 py-2 bg-muted rounded-xl text-sm text-text-primary placeholder:text-text-placeholder border border-transparent focus:border-border-focus focus:outline-none"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-forest-green text-white text-sm font-semibold transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {message && (
          <p className={`text-center text-sm ${message.type === "success" ? "text-forest-green" : "text-accent-error"}`}>
            {message.text}
          </p>
        )}

        {/* Member since */}
        {profile?.createdAt && (
          <p className="text-center text-[11px] text-text-placeholder">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
