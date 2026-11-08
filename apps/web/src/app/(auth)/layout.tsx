import { I18nProvider } from "@/i18n/I18nProvider";
import { getI18nProps } from "@/server/i18n/get-i18n";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const i18n = await getI18nProps();
  return (
    <I18nProvider {...i18n} shouldMarkLanguage>
      {children}
    </I18nProvider>
  );
}
