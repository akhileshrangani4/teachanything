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
import { AuthCardSkeleton } from "@/components/ui/skeletons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { BrandName } from "@/components/brand/BrandName";
import { useTranslation, Trans } from "react-i18next";
import { loginErrorMessage } from "@/lib/auth-error-message";
import { logError } from "@/lib/logger";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (!sessionLoading && session) {
      router.push("/dashboard");
    }
  }, [session, sessionLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authClient.signIn.email(
        {
          email,
          password,
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onSuccess: () => {
            toast.success(t("auth.login.welcomeToast"), {
              description: t("auth.login.successToast"),
            });
            router.push("/dashboard");
          },
          onError: (ctx) => {
            setLoading(false);

            // The session gate raises these only after Better Auth has
            // verified the password, so an account's approval state is never
            // revealed to someone who doesn't hold its credentials (#480).
            const errorMessage = ctx.error.message || "";

            if (errorMessage === "ACCOUNT_PENDING") {
              toast.info(t("auth.login.pendingTitle"), {
                description: t("auth.login.pendingDescription"),
              });
              router.push("/pending");
              return;
            }

            if (errorMessage === "ACCOUNT_REJECTED") {
              toast.error(t("auth.login.rejectedTitle"), {
                description: t("auth.login.rejectedDescription"),
              });
              router.push("/rejected");
              return;
            }

            // Default error handling
            const displayMessage = loginErrorMessage(t, ctx.error);

            setError(displayMessage);
            toast.error(t("auth.login.failed"), {
              description: displayMessage,
            });
          },
        },
      );
    } catch (err: unknown) {
      const errorMessage = t("auth.login.genericError");
      logError(err, "Login failed");
      setError(errorMessage);
      toast.error(t("auth.login.failed"), {
        description: errorMessage,
      });
      setLoading(false);
    }
  };

  // Don't render login form if session is loading or user is already authenticated
  if (sessionLoading || session) {
    return <AuthCardSkeleton />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("auth.login.title")}</CardTitle>
          <CardDescription>
            <Trans
              i18nKey="auth.login.description"
              components={{ brand: <BrandName /> }}
            />
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.fields.password")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t("auth.login.forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.login.submitting") : t("auth.login.submit")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Trans
              i18nKey="auth.login.noAccount"
              components={{
                a: (
                  <Link
                    href="/register"
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
