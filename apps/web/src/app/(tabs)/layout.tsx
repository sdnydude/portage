import { TabBar } from "@/components/layout/tab-bar";
import { ScanFab } from "@/components/capture/scan-fab";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-dvh">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <ScanFab />
      <TabBar />
    </div>
  );
}
