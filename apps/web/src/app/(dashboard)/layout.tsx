"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShellSkeleton } from "@/components/ui/skeletons";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MobileSidebarOverlay } from "@/components/dashboard/MobileSidebarOverlay";
import { SidebarProvider } from "@/components/dashboard/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login");
    }
  }, [session, sessionLoading, router]);

  if (sessionLoading) {
    return <DashboardShellSkeleton />;
  }

  if (!session) {
    return null;
  }

  return (
    <SidebarProvider isOpen={isOpen} setIsOpen={setIsOpen}>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
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
          <main className="flex-1 overflow-y-auto bg-noise min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
