import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import en from "../../../messages/en.json";
import { createI18n } from "@/i18n/create-i18n";

type SignInError = { code?: string; status?: number; message?: string };
type SignInHandlers = {
  onRequest?: () => void;
  onSuccess?: () => void;
  onError?: (ctx: { error: SignInError }) => void | Promise<void>;
};

let signInError: SignInError | null;
// Stands in for Better Auth's client: reports `signInError` to the page.
async function fakeSignIn(
  _body: { email: string; password: string },
  handlers: SignInHandlers,
) {
  handlers.onRequest?.();
  if (signInError) await handlers.onError?.({ error: signInError });
  else handlers.onSuccess?.();
}
const signInEmail = jest.fn(fakeSignIn);
const push = jest.fn();
const toastInfo = jest.fn();
const toastError = jest.fn();
const toastSuccess = jest.fn();

jest.unstable_mockModule("@/lib/auth-client", () => ({
  authClient: { signIn: { email: signInEmail } },
  useSession: () => ({ data: null, isPending: false }),
}));
jest.unstable_mockModule("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
jest.unstable_mockModule("sonner", () => ({
  toast: { info: toastInfo, error: toastError, success: toastSuccess },
}));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

const fetchSpy = jest.fn<typeof fetch>();

async function signIn(error: SignInError | null) {
  signInError = error;
  render(
    <I18nextProvider i18n={createI18n("en", en)}>
      <LoginPage />
    </I18nextProvider>,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(en.auth.fields.email),
    "professor@example.edu",
  );
  await user.type(screen.getByLabelText(en.auth.fields.password), "secret");
  await user.click(screen.getByRole("button", { name: en.auth.login.submit }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    // The jest config resets mock implementations between tests.
    signInEmail.mockImplementation(fakeSignIn);
    globalThis.fetch = fetchSpy;
  });

  it("sends a pending account to the pending page", async () => {
    await signIn({ status: 401, message: "ACCOUNT_PENDING" });

    expect(push).toHaveBeenCalledWith("/pending");
    expect(toastInfo).toHaveBeenCalledWith(en.auth.login.pendingTitle, {
      description: en.auth.login.pendingDescription,
    });
  });

  it("sends a rejected account to the rejected page", async () => {
    await signIn({ status: 401, message: "ACCOUNT_REJECTED" });

    expect(push).toHaveBeenCalledWith("/rejected");
  });

  it("shows the invalid-credentials message for a wrong password", async () => {
    await signIn({
      status: 401,
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    });

    expect(
      await screen.findByText(en.auth.errors.invalidCredentials),
    ).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // This path used to fall back to an anonymous status lookup by email
  // (#480). It now shows the generic error and asks the server nothing more.
  it("shows the generic error for a failure that isn't about credentials", async () => {
    await signIn({ status: 500, message: "Failed to create session" });

    expect(await screen.findByText(en.auth.login.genericError)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(signInEmail).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
