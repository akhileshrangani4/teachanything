"use client";

/** Signed-in shell shared by the dashboard and chatbot routes: session gate, header, sidebar. */

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DashboardShellSkeleton } from "@/components/ui/skeletons";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MobileSidebarOverlay } from "@/components/dashboard/MobileSidebarOverlay";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  // The session can resolve before this streamed boundary hydrates. Match the
  // server's skeleton for hydration, then render the current client session.
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login");
    }
  }, [session, sessionLoading, router]);

  if (!hydrated || sessionLoading) {
    return <DashboardShellSkeleton />;
  }

  if (!session) {
    return null;
  }

  return (
    <SidebarProvider isOpen={isOpen} setIsOpen={setIsOpen}>
      <div className="h-dvh bg-background flex flex-col overflow-hidden">
        {/* Header - Full Width */}
        <DashboardHeader />

        {/* Main Content Area with Sidebar */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar - hidden on mobile */}
          <div className="hidden lg:block">
            <DashboardSidebar />
          </div>

          {/* Mobile sidebar overlay */}
          <MobileSidebarOverlay />

          {/* Main Content - Scrollable with subtle noise texture */}
          <main className="flex-1 overflow-y-auto bg-noise min-w-0 [scrollbar-gutter:stable]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
