import { Suspense } from "react";
import { LocalizedDashboardShell } from "@/components/dashboard/LocalizedDashboardShell";
import { DashboardShellSkeleton } from "@/components/ui/skeletons";

/**
 * Same localized shell as the dashboard, so the header language menu works
 * here too. The admin pages themselves are English only.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <LocalizedDashboardShell isAdminOnly>{children}</LocalizedDashboardShell>
    </Suspense>
  );
}
