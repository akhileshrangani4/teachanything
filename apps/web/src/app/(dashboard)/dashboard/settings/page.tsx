"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileSection } from "@/components/dashboard/settings/ProfileSection";
import { InstitutionalSection } from "@/components/dashboard/settings/InstitutionalSection";
import { LanguageSection } from "@/components/dashboard/settings/LanguageSection";
import { PasswordSection } from "@/components/dashboard/settings/PasswordSection";
import { DeleteAccountSection } from "@/components/dashboard/settings/DeleteAccountSection";
import { getSupportEmail } from "@/lib/constants/support-email";
import { useTranslation, Trans } from "react-i18next";
import { ENABLED_LOCALES } from "@/i18n/config";

export default function SettingsPage() {
  const supportEmail = getSupportEmail();
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-h-0">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("settings.page.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("settings.page.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {t("settings.page.account")}
            </CardTitle>
            <CardDescription>
              {t("settings.page.accountDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProfileSection />

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">
                {t("settings.page.institutionalInfo")}
              </h3>
              <InstitutionalSection />
            </div>

            {ENABLED_LOCALES.length > 1 && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">
                  {t("settings.language.title")}
                </h3>
                <LanguageSection />
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">
                {t("settings.page.changePassword")}
              </h3>
              <PasswordSection />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                <Trans
                  i18nKey="settings.page.needHelp"
                  values={{ email: supportEmail }}
                  components={{
                    a: (
                      <a
                        href={`mailto:${supportEmail}`}
                        className="text-primary hover:underline"
                      />
                    ),
                  }}
                />
              </p>
            </div>

            <div className="border-t pt-6">
              <DeleteAccountSection />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
