"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import {
  ENABLED_LOCALES,
  isEnabledLocale,
  LOCALE_LABELS,
  type Locale,
} from "@/i18n/config";
import { useSavePreferredLocale } from "@/hooks/use-save-preferred-locale";

const BROWSER_LANGUAGE = "browser";

/**
 * Header language switcher next to the account menu, where people look for
 * one first. Languages are named in themselves rather than shown as flags,
 * since flags stand for countries, not languages. Same setting as Settings.
 */
export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const { saveLocale, isBusy } = useSavePreferredLocale();
  const currentLocale = i18n.language as Locale;
  const savedChoice = isEnabledLocale(profile?.preferredLocale)
    ? profile.preferredLocale
    : BROWSER_LANGUAGE;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label={t("settings.language.title")}
          disabled={isBusy}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {LOCALE_LABELS[currentLocale] ?? LOCALE_LABELS.en}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("settings.language.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={savedChoice}
          onValueChange={(value) => {
            if (value === savedChoice) return;
            saveLocale(value === BROWSER_LANGUAGE ? null : (value as Locale));
          }}
        >
          {ENABLED_LOCALES.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              {LOCALE_LABELS[locale]}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={BROWSER_LANGUAGE}>
            {t("settings.language.useBrowser")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
