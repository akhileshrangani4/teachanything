import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";
import { authErrorMessage, loginErrorMessage } from "@/lib/auth-error-message";

const english = createI18n("en", en);

describe("authErrorMessage", () => {
  it("maps Better Auth codes and uses the fallback otherwise", () => {
    expect(
      authErrorMessage(
        english.t,
        { code: "INVALID_EMAIL_OR_PASSWORD" },
        "fallback",
      ),
    ).toBe(en.auth.errors.invalidCredentials);
    expect(authErrorMessage(english.t, { status: 429 }, "fallback")).toBe(
      en.auth.errors.tooManyAttempts,
    );
    expect(authErrorMessage(english.t, { code: "OTHER" }, "fallback")).toBe(
      "fallback",
    );
  });
});

describe("loginErrorMessage", () => {
  it("does not blame the password for a server-side failure", () => {
    expect(
      loginErrorMessage(english.t, { code: "FAILED_TO_CREATE_SESSION" }),
    ).toBe(en.auth.login.genericError);
    expect(loginErrorMessage(english.t, { status: 500 })).toBe(
      en.auth.login.genericError,
    );
  });

  it("still reports a wrong password as wrong credentials", () => {
    expect(
      loginErrorMessage(english.t, { code: "INVALID_EMAIL_OR_PASSWORD" }),
    ).toBe(en.auth.errors.invalidCredentials);
  });
});
