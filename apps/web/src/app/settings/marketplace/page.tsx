"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface MarketplaceAccount {
  id: string;
  marketplace: "ebay" | "etsy" | "reverb";
  marketplaceUserId: string | null;
  tokenExpiresAt: string;
  createdAt: string;
}

const MARKETPLACE_INFO: Record<string, { name: string; color: string; connectPath: string | null }> = {
  ebay: { name: "eBay", color: "#e53238", connectPath: "/marketplace/ebay/connect" },
  etsy: { name: "Etsy", color: "#f1641e", connectPath: "/marketplace/etsy/connect" },
  reverb: { name: "Reverb", color: "#4a90d9", connectPath: null },
};

export default function MarketplacePage() {
  const router = useRouter();
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<{ accounts: MarketplaceAccount[] }>("/users/me/marketplace-accounts", { token })
      .then((data) => setAccounts(data.accounts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleConnect = async (marketplace: string) => {
    const info = MARKETPLACE_INFO[marketplace];
    if (!info?.connectPath || !token) return;
    try {
      const data = await api<{ authUrl: string }>(info.connectPath, { token });
      window.location.href = data.authUrl;
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

  const getAccount = (marketplace: string) => accounts.find((a) => a.marketplace === marketplace);

  const isExpired = (account: MarketplaceAccount) => new Date(account.tokenExpiresAt) < new Date();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold font-[family-name:var(--font-instrument)] text-text-primary">Marketplace Accounts</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-forest-green border-t-transparent animate-spin" />
          </div>
        ) : (
          (["ebay", "etsy", "reverb"] as const).map((marketplace) => {
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
                  ) : (
                    <span className="px-3 py-1.5 text-xs text-text-placeholder">Coming soon</span>
                  )}
                </div>

                {account && !expired && (
                  <p className="text-[11px] text-text-placeholder mt-2">
                    Connected {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
