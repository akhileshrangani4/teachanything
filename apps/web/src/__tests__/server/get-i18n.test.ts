/**
 * @jest-environment node
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

let session: { user: { preferredLocale: string | null } } | null = null;
let sessionFailure: Error | null = null;
let isSessionHanging = false;
const mockLogError = jest.fn();

jest.unstable_mockModule("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "de" }) }),
  headers: async () => new Headers({ "accept-language": "es" }),
}));
jest.unstable_mockModule("@/server/auth/config", () => ({
  auth: {
    api: {
      getSession: async () => {
        if (isSessionHanging) await new Promise(() => {});
        if (sessionFailure) throw sessionFailure;
        return session;
      },
    },
  },
}));
jest.unstable_mockModule("@/lib/logger", () => ({ logError: mockLogError }));

const { getI18nProps, generateDashboardMetadata, generateChatbotMetadata } =
  await import("@/server/i18n/get-i18n");

beforeEach(() => {
  sessionFailure = null;
  isSessionHanging = false;
  mockLogError.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("getI18nProps", () => {
  beforeEach(() => {
    session = null;
  });

  it("uses the cookie for signed-out visitors", async () => {
    await expect(getI18nProps()).resolves.toMatchObject({ locale: "de" });
  });

  it("uses a signed-in user's saved language", async () => {
    session = { user: { preferredLocale: "fr" } };
    await expect(getI18nProps()).resolves.toMatchObject({ locale: "fr" });
  });

  it("ignores another user's cookie when a signed-in user has no preference", async () => {
    session = { user: { preferredLocale: null } };
    await expect(getI18nProps()).resolves.toMatchObject({ locale: "es" });
  });

  it("uses the cookie when the session lookup fails", async () => {
    sessionFailure = new Error("connection pool timeout");
    await expect(getI18nProps()).resolves.toMatchObject({ locale: "de" });
  });

  it("stops waiting for a session lookup that hangs", async () => {
    jest.useFakeTimers();
    isSessionHanging = true;

    const props = getI18nProps();
    await jest.advanceTimersByTimeAsync(60_000);

    await expect(props).resolves.toMatchObject({ locale: "de" });
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });

  it("logs a failed session lookup", async () => {
    sessionFailure = new Error("connection pool timeout");
    await getI18nProps();
    expect(mockLogError).toHaveBeenCalledWith(
      sessionFailure,
      expect.any(String),
    );
  });
});

describe("generateDashboardMetadata", () => {
  it("titles the page in the user's saved language", async () => {
    session = { user: { preferredLocale: "fr" } };
    await expect(generateDashboardMetadata()).resolves.toEqual({
      title: "Tableau de bord",
    });
  });
});

describe("generateChatbotMetadata", () => {
  it("does not title chatbot pages as the dashboard", async () => {
    session = { user: { preferredLocale: "fr" } };
    await expect(generateChatbotMetadata()).resolves.toEqual({
      title: "Chatbots",
    });
  });
});
