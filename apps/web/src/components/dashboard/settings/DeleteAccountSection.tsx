"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useTranslation, Trans } from "react-i18next";
import { serverErrorMessage } from "@/lib/server-error-message";

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const deleteAccount = trpc.auth.deleteOwnAccount.useMutation({
    onSuccess: async () => {
      toast.success(t("settings.deleteAccount.success"), {
        description: t("settings.deleteAccount.successDescription"),
      });
      try {
        await authClient.signOut();
      } catch {
        // Session already invalidated by cascade delete; ignore
      } finally {
        router.push("/");
      }
    },
    onError: (error) => {
      toast.error(t("settings.deleteAccount.failed"), {
        description: serverErrorMessage(t, error),
      });
      setPassword("");
    },
  });

  const confirmWord = t("settings.deleteAccount.confirmWord");
  const canConfirm = password.length > 0 && confirmText === confirmWord;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await deleteAccount.mutateAsync({ password });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPassword("");
      setConfirmText("");
    }
    setShowDialog(open);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-destructive">
            {t("settings.deleteAccount.title")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("settings.deleteAccount.description")}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDialog(true)}
        >
          {t("settings.deleteAccount.title")}
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.deleteAccount.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.deleteAccount.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {t("settings.deleteAccount.willDelete")}
            </div>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li>{t("settings.deleteAccount.itemChatbots")}</li>
              <li>{t("settings.deleteAccount.itemFiles")}</li>
              <li>{t("settings.deleteAccount.itemHistory")}</li>
              <li>{t("settings.deleteAccount.itemProfile")}</li>
            </ul>
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="delete-password" className="text-sm">
                  {t("settings.deleteAccount.enterPassword")}
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("settings.deleteAccount.passwordPlaceholder")}
                  disabled={deleteAccount.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-sm">
                  <Trans
                    i18nKey="settings.deleteAccount.typeToConfirm"
                    values={{ word: confirmWord }}
                    components={{ strong: <strong /> }}
                  />
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={t("settings.deleteAccount.confirmWord")}
                  disabled={deleteAccount.isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={deleteAccount.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={deleteAccount.isPending || !canConfirm}
            >
              {deleteAccount.isPending
                ? t("settings.deleteAccount.deleting")
                : t("settings.deleteAccount.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
