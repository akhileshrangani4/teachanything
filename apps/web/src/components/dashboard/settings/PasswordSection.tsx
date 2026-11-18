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
import { useTranslation } from "react-i18next";
import { serverErrorMessage } from "@/lib/server-error-message";

export function PasswordSection() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordValidation = useMemo(() => {
    if (!newPassword) return null;
    return validatePasswordStrength(newPassword);
  }, [newPassword]);

  const updatePassword = trpc.auth.updatePassword.useMutation({
    onSuccess: () => {
      toast.success(t("settings.password.updated"), {
        description: t("settings.password.signInAgain"),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(t("settings.password.updateFailed"), {
        description: serverErrorMessage(t, error),
      });
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
      return toast.error(t("settings.password.notMeetRequirements"));
    }
    if (newPassword !== confirmPassword) {
      return toast.error(t("settings.password.mismatch"));
    }
    if (newPassword === currentPassword) {
      return toast.error(t("settings.password.mustDiffer"));
    }
    updatePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {updatePassword.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {serverErrorMessage(t, updatePassword.error)}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">
            {t("settings.password.current")}
          </Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("settings.password.currentPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">{t("settings.password.new")}</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("settings.password.newPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            {t("settings.password.confirm")}
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("settings.password.confirmPlaceholder")}
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
              {t("settings.password.match")}
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              {t("settings.password.mismatch")}
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
            {t("settings.password.updating")}
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            {t("settings.password.update")}
          </>
        )}
      </Button>
    </form>
  );
}
