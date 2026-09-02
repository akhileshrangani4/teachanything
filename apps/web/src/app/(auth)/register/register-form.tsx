"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { BrandName } from "@/components/brand/BrandName";
import { useRegister } from "./use-register";
import { RegistrationInfoAlert } from "./registration-info-alert";
import { RegisterFormFields } from "./register-form-fields";

/**
 * Registration card: admin-approval notice, status alerts, and the
 * sign-up form. State and submission live in useRegister.
 */
export function RegisterForm() {
  const form = useRegister();
  const { error, success, loading, passwordValidation, handleSubmit } = form;

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Register for <BrandName /> AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegistrationInfoAlert />

          {success && (
            <Alert className="mb-4">
              <AlertDescription>
                Registration successful! Your account is pending admin approval.
                Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <RegisterFormFields form={form} />
            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                success ||
                (passwordValidation ? !passwordValidation.isValid : false)
              }
            >
              {loading ? "Registering..." : success ? "Success!" : "Register"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
