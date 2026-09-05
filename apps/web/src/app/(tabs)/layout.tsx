export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // PorterProvider hoisted to root layout (Phase R3) — shared app-wide for the
  // dock. This layout now only owns tab-route spacing.
  return (
    <div className="flex flex-col min-h-dvh lg:min-h-0">
      <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      {/* TabBar now mounts once in AppShell for ALL non-admin routes
          (unified ownership, Task 8) — no longer owned by this layout. */}
    </div>
  );
}
