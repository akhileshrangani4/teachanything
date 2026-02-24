"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Save, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";
import { PasswordRequirementsList } from "./PasswordRequirementsList";

export function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordValidation = useMemo(() => {
    if (!newPassword) return null;
    return validatePasswordStrength(newPassword);
  }, [newPassword]);

  const updatePassword = trpc.auth.updatePassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Password updated", {
        description: "Please sign in again on other devices.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error("Failed to update password", { description: error.message });
    },
  });

  const canSubmit =
    currentPassword &&
    newPassword &&
    confirmPassword &&
    passwordValidation?.isValid &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValidation?.isValid) {
      return toast.error("Password does not meet requirements");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    if (newPassword === currentPassword) {
      return toast.error("New password must be different");
    }
    updatePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {updatePassword.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{updatePassword.error.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">New</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
        </div>
      </div>

      {newPassword && passwordValidation && (
        <PasswordStrengthIndicator validation={passwordValidation} />
      )}
      {newPassword && (
        <PasswordRequirementsList
          requirements={passwordValidation?.requirements || []}
        />
      )}

      {newPassword && confirmPassword && (
        <p
          className={`text-xs flex items-center gap-1 ${
            newPassword === confirmPassword
              ? "text-green-600"
              : "text-destructive"
          }`}
        >
          {newPassword === confirmPassword ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Passwords match
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              Passwords do not match
            </>
          )}
        </p>
      )}

      <Button
        type="submit"
        disabled={updatePassword.isPending || !canSubmit}
        size="sm"
      >
        {updatePassword.isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Updating...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Update Password
          </>
        )}
      </Button>
    </form>
  );
}
