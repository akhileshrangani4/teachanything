"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ENABLED_LOCALES,
  isEnabledLocale,
  LOCALE_LABELS,
  type Locale,
} from "@/i18n/config";

const BROWSER_LANGUAGE = "browser";
type LanguageChoice = Locale | typeof BROWSER_LANGUAGE;

/**
 * The dashboard language picker. Saving reloads the server layouts, which read
 * the saved language back from the database.
 */
export function LanguageSection() {
  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery();

  if (isLoading) return <Skeleton className="h-10 w-full rounded-md" />;
  if (!profile) return null;

  return (
    <LanguageForm
      key={profile.id}
      savedLocale={
        isEnabledLocale(profile.preferredLocale)
          ? profile.preferredLocale
          : null
      }
    />
  );
}

function LanguageForm({ savedLocale }: { savedLocale: Locale | null }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [isApplying, startApplying] = useTransition();
  const currentLocale = i18n.language as Locale;
  const savedChoice: LanguageChoice = savedLocale ?? BROWSER_LANGUAGE;
  const [draft, setDraft] = useState<LanguageChoice>(savedChoice);

  const save = trpc.auth.updatePreferredLocale.useMutation({
    onSuccess: async () => {
      await utils.auth.getProfile.invalidate();
      startApplying(() => router.refresh());
    },
    onError: (error) => {
      // No response data: the save may have gone through, so ask for a retry.
      toast.error(
        t(
          error.data
            ? "settings.language.saveFailed"
            : "settings.language.unconfirmed",
        ),
      );
    },
  });

  const isBusy = save.isPending || isApplying;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("settings.language.description")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2 w-full sm:w-64">
          <Label htmlFor="dashboard-language">
            {t("settings.language.title")}
          </Label>
          <Select
            value={draft}
            onValueChange={(value) => setDraft(value as LanguageChoice)}
            disabled={isBusy}
          >
            <SelectTrigger id="dashboard-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BROWSER_LANGUAGE}>
                {t("settings.language.useBrowser")}
              </SelectItem>
              {ENABLED_LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale} lang={locale}>
                  {LOCALE_LABELS[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() =>
            save.mutate({ locale: draft === BROWSER_LANGUAGE ? null : draft })
          }
          disabled={isBusy || draft === savedChoice}
        >
          {isBusy
            ? t("settings.language.applying")
            : t("settings.language.save")}
        </Button>
      </div>
      {savedLocale === null && (
        <p className="text-sm text-muted-foreground">
          {t("settings.language.fromBrowser", {
            language: LOCALE_LABELS[currentLocale],
          })}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t("settings.language.studentPagesNote")}
      </p>
    </div>
  );
}
