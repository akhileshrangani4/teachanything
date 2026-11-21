import type { TFunction } from "i18next";

/**
 * A Better Auth error in the user's language. Better Auth sends English, so
 * known codes map to our translations and anything else shows `fallback`.
 */
export function authErrorMessage(
  t: TFunction,
  error: { code?: string; status?: number },
  fallback: string,
): string {
  if (error.status === 429) return t("auth.errors.tooManyAttempts");
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return t("auth.errors.invalidCredentials");
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return t("auth.errors.userExists");
    case "DOMAIN_NOT_AUTHORIZED":
      return t("auth.errors.domainNotAuthorized");
    case "REGISTRATION_UNAVAILABLE":
      return t("auth.errors.registrationUnavailable");
    case "INVALID_EMAIL":
      return t("auth.errors.invalidEmail");
    case "PASSWORD_TOO_SHORT":
      return t("auth.errors.passwordTooShort");
    case "PASSWORD_TOO_LONG":
      return t("auth.errors.passwordTooLong");
    default:
      return fallback;
  }
}

/** A failed sign-in. Only a rejected password may read as wrong credentials. */
export function loginErrorMessage(
  t: TFunction,
  error: { code?: string; status?: number },
): string {
  return authErrorMessage(t, error, t("auth.login.genericError"));
}
