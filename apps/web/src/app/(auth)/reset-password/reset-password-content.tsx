"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { PasswordStrengthIndicator } from "@/components/dashboard/settings/PasswordStrengthIndicator";
import { PasswordRequirementsList } from "@/components/dashboard/settings/PasswordRequirementsList";
import { TokenErrorCard, SuccessCard, MissingTokenCard } from "./status-cards";
import { useTranslation } from "react-i18next";
import { authErrorMessage } from "@/lib/auth-error-message";
import { logError } from "@/lib/logger";
import {
  failedPasswordErrors,
  firstPasswordError,
} from "@/lib/password/password-messages";

/**
 * Checks if an error message indicates a token-related issue (invalid, expired, etc.)
 */
function isTokenRelatedError(errorMessage: string): boolean {
  const lowerMessage = errorMessage.toLowerCase();
  return (
    errorMessage.includes("INVALID_TOKEN") ||
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("expired") ||
    lowerMessage.includes("token")
  );
}

export function ResetPasswordContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");

  // Real-time password validation
  const passwordValidation = useMemo(() => {
    if (!password) {
      return null;
    }
    return validatePasswordStrength(password);
  }, [password]);

  // Password requirements checklist
  const passwordRequirements = passwordValidation?.requirements || [];

  useEffect(() => {
    if (errorParam === "INVALID_TOKEN") {
      setTokenError(true);
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password strength
    if (passwordValidation && !passwordValidation.isValid) {
      const firstError = firstPasswordError(t, passwordValidation.requirements);
      setError(firstError);
      toast.error(t("auth.resetPassword.invalidPassword"), {
        description: firstError,
      });
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError(t("settings.password.mismatch"));
      return;
    }

    if (!token) {
      setError(t("auth.resetPassword.missingToken"));
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (resetError) {
        // Check for invalid/expired token errors
        const errorMsg = resetError.message || "";

        if (isTokenRelatedError(errorMsg)) {
          setTokenError(true);
          toast.error(t("auth.resetPassword.linkExpiredTitle"), {
            description: t("auth.resetPassword.linkExpiredDescription"),
          });
        } else {
          const message = authErrorMessage(
            t,
            resetError,
            t("auth.resetPassword.failed"),
          );
          setError(message);
          toast.error(message);
        }
      } else {
        setSuccess(true);
        toast.success(t("auth.resetPassword.success"), {
          description: t("auth.resetPassword.successDescription"),
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "";

      if (isTokenRelatedError(errorMessage)) {
        setTokenError(true);
        toast.error(t("auth.resetPassword.linkExpiredTitle"), {
          description: t("auth.resetPassword.linkExpiredDescription"),
        });
      } else {
        logError(err, "Password reset failed");
        setError(t("errors.generic"));
        toast.error(t("errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenError) {
    return <TokenErrorCard />;
  }

  if (success) {
    return <SuccessCard onContinue={() => router.push("/login")} />;
  }

  if (!token) {
    return <MissingTokenCard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth.resetPassword.title")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                {t("auth.resetPassword.newPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && passwordValidation && (
                <div className="pt-1">
                  <PasswordStrengthIndicator validation={passwordValidation} />
                </div>
              )}

              {/* Password Requirements */}
              {password && (
                <div className="pt-1">
                  <PasswordRequirementsList
                    requirements={passwordRequirements}
                  />
                </div>
              )}

              {/* Validation Errors */}
              {password &&
                passwordValidation &&
                !passwordValidation.isValid &&
                passwordValidation.errors.length > 0 && (
                  <Alert variant="destructive" className="border mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <ul className="list-disc list-inside space-y-1">
                        {failedPasswordErrors(
                          t,
                          passwordValidation.requirements,
                        ).map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("auth.resetPassword.confirmNewPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">
                  {t("settings.password.mismatch")}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                (passwordValidation ? !passwordValidation.isValid : true) ||
                password !== confirmPassword
              }
            >
              {loading
                ? t("auth.resetPassword.submitting")
                : t("auth.resetPassword.submit")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.forgotPassword.backToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
