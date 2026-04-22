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

export function DeleteAccountSection() {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const deleteAccount = trpc.auth.deleteOwnAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account deleted", {
        description:
          "Your account and all associated data have been permanently removed.",
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
      toast.error("Failed to delete account", {
        description: error.message,
      });
      setPassword("");
    },
  });

  const canConfirm = password.length > 0 && confirmText === "DELETE";

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
          <p className="text-sm font-medium text-destructive">Delete Account</p>
          <p className="text-xs text-muted-foreground mt-1">
            Permanently delete your account, chatbots, files, and all associated
            data.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDialog(true)}
        >
          Delete Account
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              All of the following will be deleted:
            </div>
            <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
              <li>Your chatbots and their configurations</li>
              <li>All uploaded files</li>
              <li>Conversation history and analytics</li>
              <li>Your profile and account data</li>
            </ul>
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="delete-password" className="text-sm">
                  Enter your password to confirm
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  disabled={deleteAccount.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-sm">
                  Type <strong>DELETE</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={deleteAccount.isPending || !canConfirm}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete My Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
