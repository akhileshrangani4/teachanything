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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryCombobox } from "@/components/ui/country-combobox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { PasswordStrengthIndicator } from "@/components/dashboard/settings/PasswordStrengthIndicator";
import { PasswordRequirementsList } from "@/components/dashboard/settings/PasswordRequirementsList";
import { TITLE_OPTIONS } from "@/lib/constants/title-options";

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [titleSelection, setTitleSelection] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [name, setName] = useState("");
  const [institutionalAffiliation, setInstitutionalAffiliation] = useState("");
  const [department, setDepartment] = useState("");
  const [facultyWebpage, setFacultyWebpage] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (!sessionLoading && session) {
      router.push("/dashboard");
    }
  }, [session, sessionLoading, router]);

  // Real-time password validation
  const passwordValidation = useMemo(() => {
    if (!password) {
      return null;
    }
    return validatePasswordStrength(password);
  }, [password]);

  // Helper to check if error is due to pending account (not a real failure)
  const isAccountPendingError = (error: unknown): boolean => {
    const err = error as { message?: string; code?: string };
    const message = err.message || "";
    const code = err.code || "";
    return (
      code === "FAILED_TO_CREATE_SESSION" ||
      message === "Failed to create session" ||
      message === "ACCOUNT_PENDING"
    );
  };

  // Helper to handle successful registration (redirects to pending page)
  const handleRegistrationSuccess = () => {
    setSuccess(true);
    setLoading(false);
    toast.success("Registration successful!", {
      description: "Your account is pending admin approval",
    });
    setTimeout(() => {
      router.push("/pending");
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validate required fields
    if (!titleSelection) {
      setError("Title is required");
      toast.error("Title is required");
      return;
    }

    // Validate custom title when "Other" is selected
    if (titleSelection === "other" && !customTitle.trim()) {
      setError("Please enter your title when selecting 'Other'");
      toast.error("Title is required", {
        description: "Please enter your title when selecting 'Other'",
      });
      return;
    }

    if (!name.trim()) {
      setError("Full name is required");
      toast.error("Full name is required");
      return;
    }

    if (!institutionalAffiliation.trim()) {
      setError("Institutional affiliation is required");
      toast.error("Institutional affiliation is required");
      return;
    }

    if (!department.trim()) {
      setError("Department is required");
      toast.error("Department is required");
      return;
    }

    if (!country.trim()) {
      setError("Country is required");
      toast.error("Country is required");
      return;
    }

    if (!facultyWebpage.trim()) {
      setError("University webpage about you is required");
      toast.error("University webpage about you is required");
      return;
    }

    // Validate URL format (https:// is auto-prepended on blur if missing)
    try {
      new URL(facultyWebpage.trim());
    } catch {
      setError("Please enter a valid URL for your university webpage");
      toast.error("Invalid URL", {
        description: "Please enter a valid URL (e.g., university.edu/your-name)",
      });
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      toast.error("Email is required");
      return;
    }

    if (!password) {
      setError("Password is required");
      toast.error("Password is required");
      return;
    }

    // Password strength validation
    if (passwordValidation && !passwordValidation.isValid) {
      const firstError =
        passwordValidation.errors[0] || "Password does not meet requirements";
      setError(firstError);
      toast.error("Invalid password", {
        description: firstError,
      });
      return;
    }

    setLoading(true);

    // Resolve the title value - use custom title if "other" is selected
    // titleSelection is validated above, so we know it's a valid option
    const resolvedTitle =
      titleSelection === "other"
        ? customTitle.trim()
        : TITLE_OPTIONS.find((opt) => opt.value === titleSelection)!.label;

    try {
      await authClient.signUp.email(
        {
          name,
          email,
          password,
          title: resolvedTitle,
          institutionalAffiliation,
          department,
          country: country.trim(),
          facultyWebpage: facultyWebpage.trim(),
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onSuccess: () => {
            setSuccess(true);
            setLoading(false);
            toast.success("Registration successful!", {
              description: "Your account is pending admin approval",
            });
            // Redirect to pending page after 2 seconds
            setTimeout(() => {
              router.push("/pending");
            }, 2000);
          },
          onError: (ctx) => {
            // Account created but session blocked = success for pending users
            if (isAccountPendingError(ctx.error)) {
              handleRegistrationSuccess();
              return;
            }

            // Real error - show to user
            const errorMessage =
              ctx.error.message || "Registration failed. Please try again.";
            setError(errorMessage);
            toast.error("Registration failed", {
              description: errorMessage,
            });
            setLoading(false);
          },
        },
      );
    } catch (err) {
      // Account created but session blocked = success for pending users
      if (isAccountPendingError(err)) {
        handleRegistrationSuccess();
        return;
      }

      // Real error - show to user
      const errorMessage =
        (err as Error).message || "An error occurred during registration";
      setError(errorMessage);
      toast.error("Registration failed", {
        description: errorMessage,
      });
      setLoading(false);
    }
  };

  // Password requirements checklist
  const passwordRequirements = passwordValidation?.requirements || [];

  // Don't render registration form if session is loading or user is already authenticated
  if (sessionLoading || session) {
    return (
      <AuthCardSkeleton
        fields={4}
        titleWidth="w-36"
        descWidth="w-64"
        className="px-4 py-8"
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Register for Teach Anything AI</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              All accounts require admin approval before you can log in.
              You&apos;ll receive an email once your account is approved.
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
                <>
                  {" "}
                  If you have any questions, please contact us at{" "}
                  <a
                    href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                    className="text-primary hover:underline"
                  >
                    {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
                  </a>
                </>
              )}
            </AlertDescription>
          </Alert>

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
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Select
                value={titleSelection}
                onValueChange={(value) => {
                  setTitleSelection(value);
                  if (value !== "other") {
                    setCustomTitle("");
                  }
                }}
                disabled={loading || success}
              >
                <SelectTrigger id="title">
                  <SelectValue placeholder="Select your title" />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {titleSelection === "other" && (
                <Input
                  id="customTitle"
                  placeholder="Enter your title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  disabled={loading || success}
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institutionalAffiliation">
                Institutional Affiliation
              </Label>
              <Input
                id="institutionalAffiliation"
                placeholder="University of Example"
                value={institutionalAffiliation}
                onChange={(e) => setInstitutionalAffiliation(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Name of Your Department</Label>
              <Input
                id="department"
                placeholder="Department of Computer Science"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <CountryCombobox
                value={country}
                onValueChange={setCountry}
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facultyWebpage">University webpage about you</Label>
              <Input
                id="facultyWebpage"
                type="url"
                placeholder="university.edu/your-name"
                value={facultyWebpage}
                onChange={(e) => setFacultyWebpage(e.target.value)}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && !/^https?:\/\//i.test(val)) {
                    setFacultyWebpage(`https://${val}`);
                  }
                }}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Your university email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || success}
                minLength={8}
                maxLength={128}
              />

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
