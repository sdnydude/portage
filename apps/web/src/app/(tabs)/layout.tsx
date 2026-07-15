import { PorterProvider } from "@/hooks/use-porter-context";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PorterProvider>
      <div className="flex flex-col min-h-dvh">
        <main className="flex-1 pb-24">
          {children}
        </main>
        {/* TabBar now mounts once in AppShell for ALL non-admin routes
            (unified ownership, Task 8) — no longer owned by this layout. */}
      </div>
    </PorterProvider>
  );
}
