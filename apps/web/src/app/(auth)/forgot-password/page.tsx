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
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTranslation, Trans } from "react-i18next";
import { authErrorMessage } from "@/lib/auth-error-message";
import { logError } from "@/lib/logger";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestReset = useCallback(
    async (emailAddress: string) => {
      setLoading(true);

      try {
        const { error: resetError } = await authClient.$fetch<{
          status: boolean;
        }>("/request-password-reset", {
          method: "POST",
          body: {
            email: emailAddress,
            redirectTo: "/reset-password",
          },
        });

        if (resetError) {
          const message = authErrorMessage(
            t,
            resetError,
            t("auth.forgotPassword.sendFailed"),
          );
          setError(message);
          toast.error(message);
          return false;
        }

        return true;
      } catch (err: unknown) {
        const errorMessage = t("errors.generic");
        logError(err, "Password reset request failed");
        setError(errorMessage);
        toast.error(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const sent = await requestReset(email);
    if (sent) {
      setSuccess(true);
      setCooldown(COOLDOWN_SECONDS);
      toast.success(t("auth.forgotPassword.requestSubmitted"), {
        description: t("auth.forgotPassword.requestSubmittedDescription"),
      });
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;

    const sent = await requestReset(email);
    if (sent) {
      setCooldown(COOLDOWN_SECONDS);
      toast.success(t("auth.forgotPassword.resent"), {
        description: t("auth.forgotPassword.resentDescription"),
      });
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>{t("auth.forgotPassword.checkEmailTitle")}</CardTitle>
            <CardDescription>
              <Trans
                i18nKey="auth.forgotPassword.checkEmailDescription"
                values={{ email }}
                components={{
                  b: <span className="font-medium text-foreground" />,
                }}
              />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {t("auth.forgotPassword.linkExpiry")}
            </p>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {t("auth.forgotPassword.notReceived")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
              >
                {loading
                  ? t("auth.forgotPassword.sending")
                  : cooldown > 0
                    ? t("auth.forgotPassword.resendIn", { seconds: cooldown })
                    : t("auth.forgotPassword.resend")}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                  setCooldown(0);
                }}
                className="text-primary hover:underline"
              >
                {t("auth.forgotPassword.differentEmail")}
              </button>
            </p>
            <div className="pt-2">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t("auth.forgotPassword.backToLogin")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth.forgotPassword.title")}</CardTitle>
          <CardDescription>
            {t("auth.forgotPassword.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.fields.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.fields.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t("auth.forgotPassword.sending")
                : t("auth.forgotPassword.submit")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Trans
              i18nKey="auth.forgotPassword.rememberPassword"
              components={{
                a: (
                  <Link
                    href="/login"
                    className="text-primary hover:underline"
                  />
                ),
              }}
            />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
