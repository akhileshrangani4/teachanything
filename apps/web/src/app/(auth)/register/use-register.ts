"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { TITLE_OPTIONS } from "@/lib/constants/title-options";

/**
 * Owns all registration form state: field values, real-time password
 * validation, field-by-field submit validation (with identical error and
 * toast copy), and the sign-up flow including the pending-account
 * success path.
 */
export function useRegister() {
  const router = useRouter();
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

  // Real-time password validation
  const passwordValidation = useMemo(() => {
    if (!password) {
      return null;
    }
    return validatePasswordStrength(password);
  }, [password]);

  // Password requirements checklist
  const passwordRequirements = passwordValidation?.requirements || [];

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
        description:
          "Please enter a valid URL (e.g., university.edu/your-name)",
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

  return {
    titleSelection,
    setTitleSelection,
    customTitle,
    setCustomTitle,
    name,
    setName,
    institutionalAffiliation,
    setInstitutionalAffiliation,
    department,
    setDepartment,
    facultyWebpage,
    setFacultyWebpage,
    country,
    setCountry,
    email,
    setEmail,
    password,
    setPassword,
    error,
    success,
    loading,
    passwordValidation,
    passwordRequirements,
    handleSubmit,
  };
}

export type RegisterForm = ReturnType<typeof useRegister>;
