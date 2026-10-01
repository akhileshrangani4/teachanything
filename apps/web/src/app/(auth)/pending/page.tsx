"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PendingPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleBackToLogin = async () => {
    setIsRedirecting(true);
    try {
      // Check if there's an active session first
      const session = await authClient.getSession();

      if (session.data) {
        // If session exists, sign out properly
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/login");
            },
            onError: () => {
              // Even if sign-out fails, redirect to login
              router.push("/login");
            },
          },
        });
      } else {
        // No session exists (pending user), just redirect to login
        router.push("/login");
      }
    } catch {
      // On any error, just redirect to login
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account Pending Approval</CardTitle>
          <CardDescription>Your registration has been received</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              <p className="mb-4">
                Your account is currently awaiting approval from an
                administrator. You&apos;ll receive an email notification once
                your account has been reviewed.
              </p>
              <p className="text-sm text-muted-foreground">
                This typically takes 24-48 hours during business days.
              </p>
            </AlertDescription>
          </Alert>

          <div className="mt-6 space-y-4">
            <Button
              onClick={handleBackToLogin}
              variant="outline"
              className="w-full"
              disabled={isRedirecting}
            >
              {isRedirecting ? "Redirecting..." : "Back to Login"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Questions? Email us at{" "}
                <a
                  href="mailto:admin@teachanything.ai"
                  className="text-primary hover:underline"
                >
                  admin@teachanything.ai
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
