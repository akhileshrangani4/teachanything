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

interface MicrophoneHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MicrophoneHelpDialog({
  open,
  onOpenChange,
}: MicrophoneHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Microphone access is blocked</DialogTitle>
          <DialogDescription>
            You can still type your question. To use voice input, allow
            microphone access:
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-3">
          <div>
            <p className="font-medium">Desktop browsers</p>
            <p className="text-muted-foreground">
              Click the lock or site-info icon in the address bar, find
              Microphone, and switch it to Allow. Then reload the page.
            </p>
          </div>
          <div>
            <p className="font-medium">iPhone &amp; iPad (Safari)</p>
            <p className="text-muted-foreground">
              Open the Settings app, scroll to Safari, tap Microphone, and allow
              this site. Reload the page.
            </p>
          </div>
          <div>
            <p className="font-medium">Android (Chrome)</p>
            <p className="text-muted-foreground">
              Tap the lock icon next to the URL, then Permissions, then
              Microphone, and choose Allow. Reload the page.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
