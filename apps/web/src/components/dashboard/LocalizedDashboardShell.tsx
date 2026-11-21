import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getI18nProps } from "@/server/i18n/get-i18n";

/** The dashboard shell in the user's language. Suspends on the session lookup. */
export async function LocalizedDashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const i18n = await getI18nProps();
  return (
    <I18nProvider {...i18n} shouldMarkLanguage>
      <DashboardShell>{children}</DashboardShell>
    </I18nProvider>
  );
}
