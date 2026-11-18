"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

interface MicrophoneHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MicrophoneHelpDialog({
  open,
  onOpenChange,
}: MicrophoneHelpDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.microphoneHelp.title")}</DialogTitle>
          <DialogDescription>
            {t("chat.microphoneHelp.intro")}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-3">
          <div>
            <p className="font-medium">
              {t("chat.microphoneHelp.desktopTitle")}
            </p>
            <p className="text-muted-foreground">
              {t("chat.microphoneHelp.desktopSteps")}
            </p>
          </div>
          <div>
            <p className="font-medium">{t("chat.microphoneHelp.iosTitle")}</p>
            <p className="text-muted-foreground">
              {t("chat.microphoneHelp.iosSteps")}
            </p>
          </div>
          <div>
            <p className="font-medium">
              {t("chat.microphoneHelp.androidTitle")}
            </p>
            <p className="text-muted-foreground">
              {t("chat.microphoneHelp.androidSteps")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t("chat.microphoneHelp.gotIt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
