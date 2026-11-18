"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";

export function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  // A link to the page already showing the error would not clear it.
  const isDashboardHome = usePathname() === "/dashboard";
  useEffect(() => {
    logError(error, "Dashboard page failed to render", {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("common.pageError.title")}</h1>
      <p className="text-muted-foreground">
        {isDashboardHome
          ? t("common.pageError.descriptionHome")
          : t("common.pageError.description")}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <Button onClick={reset}>{t("common.actions.tryAgain")}</Button>
        {!isDashboardHome && (
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              {t("common.pageError.backToDashboard")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
