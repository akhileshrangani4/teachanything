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
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { PasswordStrengthIndicator } from "@/components/dashboard/settings/PasswordStrengthIndicator";
import { PasswordRequirementsList } from "@/components/dashboard/settings/PasswordRequirementsList";

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

function ResetPasswordContent() {
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
      const firstError =
        passwordValidation.errors[0] || "Password does not meet requirements";
      setError(firstError);
      toast.error("Invalid password", {
        description: firstError,
      });
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
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
          toast.error("Link expired", {
            description:
              "This password reset link has already been used or has expired. Please request a new one.",
          });
        } else {
          setError(resetError.message || "Failed to reset password");
          toast.error("Error", {
            description: resetError.message || "Failed to reset password",
          });
        }
      } else {
        setSuccess(true);
        toast.success("Password reset!", {
          description: "Your password has been successfully reset",
        });
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";

      if (isTokenRelatedError(errorMessage)) {
        setTokenError(true);
        toast.error("Link expired", {
          description:
            "This password reset link has already been used or has expired. Please request a new one.",
        });
      } else {
        setError(errorMessage);
        toast.error("Error", {
          description: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenError) {
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

  if (success) {
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
            <Button className="w-full" onClick={() => router.push("/login")}>
              Continue to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <CardTitle>Missing Reset Token</CardTitle>
            <CardDescription>
              No password reset token found. Please use the link from your
              email.
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
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
              <Label htmlFor="password">New Password</Label>
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
                        {passwordValidation.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
                  Passwords do not match
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
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<AuthCardSkeleton titleWidth="w-36" />}
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
