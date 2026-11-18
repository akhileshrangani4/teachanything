"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { useState } from "react";
import { toast } from "sonner";
import { Save, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { serverErrorMessage } from "@/lib/server-error-message";

export function ProfileSection() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user.name || "");

  const updateName = trpc.auth.updateName.useMutation({
    onSuccess: () => {
      toast.success(t("settings.profile.nameUpdated"));
      window.location.reload();
    },
    onError: (error) => {
      toast.error(t("settings.profile.nameUpdateFailed"), {
        description: serverErrorMessage(t, error),
      });
    },
  });

  const handleUpdateName = () => {
    if (!name.trim()) {
      toast.error(t("settings.profile.nameEmpty"));
      return;
    }
    updateName.mutate({ name: name.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("settings.profile.name")}</Label>
        <div className="flex gap-2">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.profile.namePlaceholder")}
            className="flex-1"
          />
          <Button
            onClick={handleUpdateName}
            disabled={
              updateName.isPending ||
              name === session?.user.name ||
              !name.trim()
            }
            size="sm"
          >
            {updateName.isPending ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </Button>
        </div>
        {name === session?.user.name && name.trim() && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("settings.profile.upToDate")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("settings.profile.email")}</Label>
        <Input
          id="email"
          value={session?.user.email || ""}
          disabled
          className="bg-muted/50"
        />
        <p className="text-xs text-muted-foreground">
          {t("settings.profile.emailLocked")}
        </p>
      </div>
    </div>
  );
}
