// Logged-out /home hero. The CTA is a PLAIN ANCHOR on purpose: Cloudflare
// Access logs a user in by intercepting a full document request at the edge
// and bouncing through the IdP — a next/link client-side navigation never
// leaves the SPA, so it can never start a login (the old <Link href="/">
// was a dead loop through the root redirect, live bug 2026-07-10).
export function LoggedOutHero() {
  return (
    <div className="px-4 py-6 content-container">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-3xl bg-forest-green-50 flex items-center justify-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--forest-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 className="font-[family-name:var(--font-instrument)] font-bold text-text-primary mb-2 text-2xl">
          Welcome to Portage
        </h1>
        <p className="text-text-secondary mb-6 max-w-xs text-sm">
          AI-powered inventory and marketplace selling. Scan, list, and sell your items in seconds.
        </p>
        <a
          href="/home"
          data-full-navigation="true"
          className="px-8 py-3 rounded-full bg-forest-green text-white font-semibold text-sm"
        >
          Get Started
        </a>
      </div>
    </div>
  );
}
