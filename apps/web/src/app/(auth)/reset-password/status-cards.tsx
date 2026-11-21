"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Shown when the reset link is invalid or expired. */
export function TokenErrorCard() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle>{t("auth.resetPassword.invalidLinkTitle")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.invalidLinkDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {t("auth.resetPassword.invalidLinkHelp")}
          </p>
          <div className="flex flex-col gap-4 pt-2">
            <Link href="/forgot-password">
              <Button className="w-full">
                {t("auth.resetPassword.requestNewLink")}
              </Button>
            </Link>
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

/** Shown after the password has been reset successfully. */
export function SuccessCard({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>{t("auth.resetPassword.successTitle")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.successBody")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onContinue}>
            {t("auth.resetPassword.continueToLogin")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Shown when the token query param is absent. */
export function MissingTokenCard() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-yellow-600" />
          </div>
          <CardTitle>{t("auth.resetPassword.missingTokenTitle")}</CardTitle>
          <CardDescription>
            {t("auth.resetPassword.missingTokenBody")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link href="/forgot-password">
            <Button className="w-full">
              {t("auth.resetPassword.requestReset")}
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("auth.forgotPassword.backToLogin")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
