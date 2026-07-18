// Shared nav/route constants for the responsive shell (AppShell, Sidebar,
// TabBar, TopBar, AskPorterBar). Plain data — no React.

// HIG alignment (docs/research/2026-07-15-apple-hig-ios26-shell-alignment.md):
// the mobile bar holds 5 tabs max; More/settings is reached via the PageHeader
// avatar on mobile and the sidebar secondary section on lg+.
// Listings dropped from the bar 2026-07-17 (4 tabs + center Scan) — the
// /listings ROUTE stays fully functional, reached from Home modules and
// inventory links.
export const BAR_TABS = [
  "/home",
  "/inventory",
  "/porter",
  "/orders",
] as const;

export const SIDEBAR_SECONDARY = [
  { href: "/messages", label: "Messages" },
  { href: "/more", label: "Settings" },
] as const;

export function isTabRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return (BAR_TABS as readonly string[]).includes(pathname);
}

const PAGE_TITLES: Array<[prefix: string, title: string]> = [
  ["/home", "Home"],
  ["/inventory", "Inventory"],
  ["/listings", "Listings"],
  ["/porter", "Porter"],
  ["/orders", "Orders"],
  ["/more", "Settings"],
  ["/settings/seller-profile", "Seller Profile"],
  ["/settings/marketplace", "Marketplace Accounts"],
  ["/settings/billing", "Billing & Plan"],
  ["/settings/notifications", "Notifications"],
  ["/settings/profile", "Profile"],
  ["/settings/help", "Help & Support"],
  ["/messages", "Messages"],
  ["/list", "New Listing"],
];

export function pageTitle(pathname: string): string {
  let best: string | null = null;
  let bestLen = 0;
  for (const [prefix, title] of PAGE_TITLES) {
    if (pathname.startsWith(prefix) && prefix.length > bestLen) {
      best = title;
      bestLen = prefix.length;
    }
  }
  return best ?? "Portage";
}

const DEFAULT_PILLS = [
  "What should I list next?",
  "How's my inventory doing?",
];

const PILLS: Array<[prefix: string, pills: string[]]> = [
  ["/inventory", ["What's unlisted?", "What's my total inventory value?"]],
  ["/listings", ["Which listings are stale?", "Suggest reprices for slow listings"]],
  ["/orders", ["What needs shipping?", "How much did I make this month?"]],
];

export function porterPills(pathname: string): string[] {
  for (const [prefix, pills] of PILLS) {
    if (pathname.startsWith(prefix)) return pills;
  }
  return DEFAULT_PILLS;
}
