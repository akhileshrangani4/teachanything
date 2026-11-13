"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { validatePasswordStrength } from "@/lib/password/password-strength";
import { TITLE_OPTIONS } from "@/lib/constants/title-options";
import { useTranslation } from "react-i18next";
import { authErrorMessage } from "@/lib/auth-error-message";
import { firstPasswordError } from "@/lib/password/password-messages";
import { logError } from "@/lib/logger";

/**
 * Owns all registration form state: field values, real-time password
 * validation, field-by-field submit validation (with identical error and
 * toast copy), and the sign-up flow including the pending-account
 * success path.
 */
export function useRegister() {
  const { t } = useTranslation();
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
    toast.success(t("auth.register.successToast"), {
      description: t("auth.register.pendingToast"),
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
      setError(t("auth.register.titleRequired"));
      toast.error(t("auth.register.titleRequired"));
      return;
    }

    // Validate custom title when "Other" is selected
    if (titleSelection === "other" && !customTitle.trim()) {
      setError(t("auth.register.otherTitleRequired"));
      toast.error(t("auth.register.titleRequired"), {
        description: t("auth.register.otherTitleRequired"),
      });
      return;
    }

    if (!name.trim()) {
      setError(t("auth.register.fullNameRequired"));
      toast.error(t("auth.register.fullNameRequired"));
      return;
    }

    if (!institutionalAffiliation.trim()) {
      setError(t("auth.register.affiliationRequired"));
      toast.error(t("auth.register.affiliationRequired"));
      return;
    }

    if (!department.trim()) {
      setError(t("auth.register.departmentRequired"));
      toast.error(t("auth.register.departmentRequired"));
      return;
    }

    if (!country.trim()) {
      setError(t("auth.register.countryRequired"));
      toast.error(t("auth.register.countryRequired"));
      return;
    }

    if (!facultyWebpage.trim()) {
      setError(t("auth.register.webpageRequired"));
      toast.error(t("auth.register.webpageRequired"));
      return;
    }

    // Validate URL format (https:// is auto-prepended on blur if missing)
    try {
      new URL(facultyWebpage.trim());
    } catch {
      setError(t("auth.register.webpageInvalid"));
      toast.error(t("auth.register.invalidUrlTitle"), {
        description: t("auth.register.invalidUrlHint"),
      });
      return;
    }

    if (!email.trim()) {
      setError(t("auth.register.emailRequired"));
      toast.error(t("auth.register.emailRequired"));
      return;
    }

    if (!password) {
      setError(t("auth.register.passwordRequired"));
      toast.error(t("auth.register.passwordRequired"));
      return;
    }

    // Password strength validation
    if (passwordValidation && !passwordValidation.isValid) {
      const firstError = firstPasswordError(t, passwordValidation.requirements);
      setError(firstError);
      toast.error(t("auth.resetPassword.invalidPassword"), {
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
            toast.success(t("auth.register.successToast"), {
              description: t("auth.register.pendingToast"),
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
            const errorMessage = authErrorMessage(
              t,
              ctx.error,
              t("auth.register.failedRetry"),
            );
            setError(errorMessage);
            toast.error(t("auth.register.failed"), {
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
      const errorMessage = t("auth.register.genericError");
      logError(err, "Registration failed");
      setError(errorMessage);
      toast.error(t("auth.register.failed"), {
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
