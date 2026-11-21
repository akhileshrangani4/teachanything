import { Suspense } from "react";
import { LocalizedDashboardShell } from "@/components/dashboard/LocalizedDashboardShell";
import { DashboardShellSkeleton } from "@/components/ui/skeletons";
import { generateChatbotMetadata } from "@/server/i18n/get-i18n";

export const generateMetadata = generateChatbotMetadata;

export default function ChatbotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <LocalizedDashboardShell>{children}</LocalizedDashboardShell>
    </Suspense>
  );
}
