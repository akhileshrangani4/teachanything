import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { Locale } from "@/i18n/config";

/**
 * Save the dashboard language (null follows the browser), then reload the
 * server layouts, which read the saved language back from the database.
 * Shared by the header language menu and the Settings page.
 */
export function useSavePreferredLocale() {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [isApplying, startApplying] = useTransition();

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

  return {
    saveLocale: (locale: Locale | null) => save.mutate({ locale }),
    isBusy: save.isPending || isApplying,
  };
}
