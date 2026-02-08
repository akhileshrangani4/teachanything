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
import { trpc } from "@/lib/trpc";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

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
            toast.success("Welcome back!", {
              description: "Login successful",
            });
            router.push("/dashboard");
          },
          onError: async (ctx) => {
            setLoading(false);

            // Check for specific error messages from Better Auth
            const errorMessage = ctx.error.message || "";

            if (errorMessage === "ACCOUNT_PENDING") {
              toast.info("Account Pending", {
                description: "Your account is awaiting admin approval",
              });
              router.push("/pending");
              return;
            }

            if (errorMessage === "ACCOUNT_REJECTED") {
              toast.error("Account Rejected", {
                description: "Your registration was not approved",
              });
              router.push("/rejected");
              return;
            }

            // For other errors, check user status as fallback
            if (!errorMessage.includes("credentials") && email) {
              try {
                const statusResult =
                  await utils.client.auth.checkUserStatus.query({
                    email,
                  });

                if (statusResult.exists && statusResult.status === "pending") {
                  toast.info("Account Pending", {
                    description: "Your account is awaiting admin approval",
                  });
                  router.push("/pending");
                  return;
                } else if (
                  statusResult.exists &&
                  statusResult.status === "rejected"
                ) {
                  toast.error("Account Rejected", {
                    description: "Your registration was not approved",
                  });
                  router.push("/rejected");
                  return;
                }
              } catch {
                // If status check fails, fall through to regular error handling
              }
            }

            // Default error handling
            const displayMessage =
              errorMessage === "ACCOUNT_PENDING" ||
              errorMessage === "ACCOUNT_REJECTED"
                ? "Login failed. Please check your credentials."
                : errorMessage ||
                  "Login failed. Please check your credentials.";

            setError(displayMessage);
            toast.error("Login failed", {
              description: displayMessage,
            });
          },
        },
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during login";
      setError(errorMessage);
      toast.error("Login failed", {
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
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>
            Login to your Teach anything account
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
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
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
