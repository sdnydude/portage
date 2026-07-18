"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface MarketplaceAccount {
  id: string;
  marketplace: "ebay" | "reverb";
  marketplaceUserId: string | null;
  tokenExpiresAt: string;
  createdAt: string;
}

const MARKETPLACE_INFO: Record<string, { name: string; color: string; connectPath: string | null }> = {
  ebay: { name: "eBay", color: "#e53238", connectPath: "/marketplace/ebay/connect" },
  reverb: { name: "Reverb", color: "#4a90d9", connectPath: null },
};

export default function MarketplacePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reverbToken, setReverbToken] = useState("");
  const [reverbConnecting, setReverbConnecting] = useState(false);
  const [showReverbInput, setShowReverbInput] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ accounts: MarketplaceAccount[] }>("/users/me/marketplace-accounts", { token })
      .then((data) => setAccounts(data.accounts))
      .catch(() => setError("Failed to load marketplace accounts"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConnect = async (marketplace: string) => {
    const info = MARKETPLACE_INFO[marketplace];
    if (!info?.connectPath || !token) return;
    try {
      const data = await api<{ authUrl: string }>(info.connectPath, { token });
      window.location.assign(data.authUrl);
    } catch {
      alert(`Failed to start ${info.name} connection`);
    }
  };

  const handleDisconnect = async (marketplace: string) => {
    if (!token || !confirm(`Disconnect ${MARKETPLACE_INFO[marketplace]?.name}?`)) return;
    try {
      await api(`/marketplace/${marketplace}/disconnect`, { method: "DELETE", token });
      setAccounts((prev) => prev.filter((a) => a.marketplace !== marketplace));
    } catch {
      alert("Failed to disconnect");
    }
  };

  const handleReverbConnect = async () => {
    if (!token || !reverbToken.trim() || reverbConnecting) return;
    setReverbConnecting(true);
    try {
      await api("/marketplace/reverb/connect", { method: "POST", token, body: { token: reverbToken.trim() } });
      const data = await api<{ accounts: MarketplaceAccount[] }>("/users/me/marketplace-accounts", { token });
      setAccounts(data.accounts);
      setReverbToken("");
      setShowReverbInput(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to connect Reverb");
    } finally {
      setReverbConnecting(false);
    }
  };

  const getAccount = (marketplace: string) => accounts.find((a) => a.marketplace === marketplace);

  const isExpired = (account: MarketplaceAccount) => new Date(account.tokenExpiresAt) < new Date();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 content-container">
          <button onClick={() => router.back()} className="p-1 -ml-1" aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Marketplace Accounts</h1>
        </div>
      </header>

      <div className="px-4 py-6 content-container space-y-3 compact-bar-clearance">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-accent-error bg-red-50 dark:bg-red-950/30 p-4 text-sm text-accent-error">
            {error}
          </div>
        ) : (
          (["ebay", "reverb"] as const).map((marketplace) => {
            const info = MARKETPLACE_INFO[marketplace];
            const account = getAccount(marketplace);
            const expired = account ? isExpired(account) : false;

            return (
              <div
                key={marketplace}
                className="rounded-2xl border border-border bg-surface p-4"
                style={{ boxShadow: "var(--shadow-subtle)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: info.color }}
                    >
                      {info.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{info.name}</h3>
                      {account ? (
                        <p className={`text-xs ${expired ? "text-accent-error" : "text-forest-green"}`}>
                          {expired ? "Token expired — reconnect" : "Connected"}
                          {account.marketplaceUserId && ` (${account.marketplaceUserId})`}
                        </p>
                      ) : (
                        <p className="text-xs text-text-secondary">Not connected</p>
                      )}
                    </div>
                  </div>

                  {account ? (
                    <button
                      onClick={() => handleDisconnect(marketplace)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-accent-error text-accent-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : info.connectPath ? (
                    <button
                      onClick={() => handleConnect(marketplace)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-forest-green text-white transition-opacity hover:opacity-90"
                    >
                      Connect
                    </button>
                  ) : marketplace === "reverb" ? (
                    <button
                      onClick={() => setShowReverbInput(!showReverbInput)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-forest-green text-white transition-opacity hover:opacity-90"
                    >
                      Connect
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 text-xs text-text-placeholder">Coming soon</span>
                  )}
                </div>

                {account && !expired && (
                  <p className="text-[11px] text-text-placeholder mt-2">
                    Connected {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                )}

                {marketplace === "ebay" && account && (
                  <a
                    href="/settings/seller-profile"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-forest-green hover:underline"
                  >
                    Finish eBay setup — ship-from &amp; selling policies →
                  </a>
                )}

                {marketplace === "reverb" && !account && showReverbInput && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-text-secondary">
                      Paste your Reverb Personal Access Token. Get one from{" "}
                      <a href="https://reverb.com/my/api_settings" target="_blank" rel="noopener noreferrer" className="text-forest-green underline">
                        reverb.com/my/api_settings
                      </a>
                    </p>
                    <input
                      type="password"
                      value={reverbToken}
                      onChange={(e) => setReverbToken(e.target.value)}
                      placeholder="Paste token here..."
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-text-primary text-sm focus:border-border-focus focus:outline-none"
                    />
                    <button
                      onClick={handleReverbConnect}
                      disabled={!reverbToken.trim() || reverbConnecting}
                      className="w-full py-2 rounded-xl bg-forest-green text-white text-sm font-medium disabled:opacity-50 transition-opacity"
                    >
                      {reverbConnecting ? "Validating..." : "Save Token"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
