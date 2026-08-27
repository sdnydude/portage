import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PorterProvider } from "@/hooks/use-porter-context";
import { CurrentItemProvider } from "@/hooks/use-current-item";
import { AppShell } from "@/components/layout/app-shell";
import { BetaCta } from "@/components/beta/beta-cta";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portage — Smart Inventory & Seller",
  description: "AI-powered personal effects inventory and multi-marketplace seller app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Portage",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // The status bar overlays the dark graphite Porter hero in both themes
  // (viewportFit cover + safe-area padding), so match the hero top in both.
  themeColor: "#262A2D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Set the theme class before paint: stored override, else OS preference. */}
        <script
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- static developer-authored theme bootstrap, no user input
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
        <AuthProvider>
          {/* PorterProvider hoisted from (tabs) to root (Phase R3) so the
              AppShell dock-slot shares Porter chat state on every route,
              including non-tab routes like inventory/[id], admin, settings. */}
          <PorterProvider>
            <CurrentItemProvider>
              <AppShell>{children}</AppShell>
            </CurrentItemProvider>
          </PorterProvider>
          <BetaCta />
        </AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
