"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { AlertCircle } from "lucide-react";
import { PasswordStrengthIndicator } from "@/components/dashboard/settings/PasswordStrengthIndicator";
import { PasswordRequirementsList } from "@/components/dashboard/settings/PasswordRequirementsList";
import { TITLE_OPTIONS } from "@/lib/constants/title-options";
import type { RegisterForm } from "./use-register";
import { useTranslation } from "react-i18next";
import { failedPasswordErrors } from "@/lib/password/password-messages";

/**
 * All registration form fields: title (with custom "Other" input),
 * profile details, credentials, and the live password strength UI.
 */
export function RegisterFormFields({ form }: { form: RegisterForm }) {
  const { t } = useTranslation();
  const {
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
    success,
    loading,
    passwordValidation,
    passwordRequirements,
  } = form;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">{t("auth.register.titleLabel")}</Label>
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
            <SelectValue placeholder={t("auth.register.selectYourTitle")} />
          </SelectTrigger>
          <SelectContent>
            {TITLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`settings.titles.${option.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {titleSelection === "other" && (
          <Input
            id="customTitle"
            placeholder={t("auth.register.enterYourTitle")}
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            disabled={loading || success}
            className="mt-2"
          />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">{t("auth.register.fullName")}</Label>
        <Input
          id="name"
          placeholder={t("auth.register.fullNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading || success}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="institutionalAffiliation">
          {t("auth.register.affiliation")}
        </Label>
        <Input
          id="institutionalAffiliation"
          placeholder={t("auth.register.affiliationPlaceholder")}
          value={institutionalAffiliation}
          onChange={(e) => setInstitutionalAffiliation(e.target.value)}
          required
          disabled={loading || success}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="department">{t("auth.register.department")}</Label>
        <Input
          id="department"
          placeholder={t("auth.register.departmentPlaceholder")}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
          disabled={loading || success}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("auth.register.country")}</Label>
        <CountryCombobox
          value={country}
          onValueChange={setCountry}
          disabled={loading || success}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="facultyWebpage">{t("auth.register.webpage")}</Label>
        <Input
          id="facultyWebpage"
          type="url"
          placeholder={t("auth.register.webpagePlaceholder")}
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
        <Label htmlFor="email">{t("auth.register.universityEmail")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("auth.fields.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading || success}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.fields.password")}</Label>
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
            <PasswordRequirementsList requirements={passwordRequirements} />
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
                  {failedPasswordErrors(t, passwordValidation.requirements).map(
                    (error, idx) => (
                      <li key={idx}>{error}</li>
                    ),
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
      </div>
    </>
  );
}
