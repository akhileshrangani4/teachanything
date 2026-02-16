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

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
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

  const requestReset = useCallback(async (emailAddress: string) => {
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
        setError(resetError.message || "Failed to send reset email");
        toast.error("Error", {
          description: resetError.message || "Failed to send reset email",
        });
        return false;
      }

      return true;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
      setError(errorMessage);
      toast.error("Error", {
        description: errorMessage,
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const sent = await requestReset(email);
    if (sent) {
      setSuccess(true);
      setCooldown(COOLDOWN_SECONDS);
      toast.success("Request submitted!", {
        description: "If an account exists, you'll receive a reset link",
      });
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;

    const sent = await requestReset(email);
    if (sent) {
      setCooldown(COOLDOWN_SECONDS);
      toast.success("New reset link sent!", {
        description: "Check your inbox for the new link",
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
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              If an account exists for{" "}
              <span className="font-medium text-foreground">{email}</span>,
              we&apos;ve sent a password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Click the link in the email to reset your password. The link will
              expire in 1 hour.
            </p>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn&apos;t receive the email? Check your spam folder or
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
              >
                {loading
                  ? "Sending..."
                  : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : "Resend reset link"}
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
                Try with a different email address
              </button>
            </p>
            <div className="pt-2">
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset
            your password
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
