import { PorterProvider } from "@/hooks/use-porter-context";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PorterProvider>
      {/* lg:min-h-0 — inside shell-main the shell already owns min-h-dvh;
          a nested min-h-dvh under the 64px TopBar overflows by that height. */}
      <div className="flex flex-col min-h-dvh lg:min-h-0">
        <main className="flex-1 pb-24">
          {children}
        </main>
        {/* TabBar now mounts once in AppShell for ALL non-admin routes
            (unified ownership, Task 8) — no longer owned by this layout. */}
      </div>
    </PorterProvider>
  );
}
