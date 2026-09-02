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

/** Shown when the reset link is invalid or expired. */
export function TokenErrorCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle>Invalid or Expired Link</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Password reset links expire after 1 hour for security reasons.
            Please request a new one.
          </p>
          <div className="flex flex-col gap-4 pt-2">
            <Link href="/forgot-password">
              <Button className="w-full">Request New Reset Link</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Password Reset Successfully</CardTitle>
          <CardDescription>
            Your password has been updated. You can now log in with your new
            password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onContinue}>
            Continue to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Shown when the token query param is absent. */
export function MissingTokenCard() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-yellow-600" />
          </div>
          <CardTitle>Missing Reset Token</CardTitle>
          <CardDescription>
            No password reset token found. Please use the link from your email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Link href="/forgot-password">
            <Button className="w-full">Request Password Reset</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
