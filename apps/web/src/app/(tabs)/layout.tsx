import { TabBar } from "@/components/layout/tab-bar";
import { PorterProvider } from "@/hooks/use-porter-context";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PorterProvider>
      <div className="flex flex-col min-h-dvh">
        <main className="flex-1 pb-20">
          {children}
        </main>
        {/* TabBar includes scan flow modal — no separate scan route needed */}
        <TabBar />
      </div>
    </PorterProvider>
  );
}
