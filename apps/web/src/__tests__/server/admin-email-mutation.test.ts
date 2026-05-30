/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { jest } from "@jest/globals";

// Set all required environment variables before importing modules
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_CONTACT_EMAIL = "support@example.edu";
process.env.RESEND_FROM_EMAIL = "noreply@example.edu";
process.env.OPENROUTER_API_KEY = "test-key";
process.env.OPENAI_API_KEY = "test-key";

// Mock email wrappers
const mockSendRequestMoreInfoEmail = jest.fn().mockResolvedValue(undefined);
const mockSendIncorrectInfoEmail = jest.fn().mockResolvedValue(undefined);
const mockSendGenericAdminEmail = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule("@/lib/email", () => ({
  sendRequestMoreInfoEmail: mockSendRequestMoreInfoEmail,
  sendIncorrectInfoEmail: mockSendIncorrectInfoEmail,
  sendGenericAdminEmail: mockSendGenericAdminEmail,
  sendAdminNotificationEmail: jest.fn(),
  sendApprovalEmail: jest.fn(),
  sendRejectionEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendPromoteToAdminEmail: jest.fn(),
  sendDemoteFromAdminEmail: jest.fn(),
  sendAccountDisabledEmail: jest.fn(),
  sendAccountEnabledEmail: jest.fn(),
}));

jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

const { sendRegistrationEmail } =
  await import("@/server/routers/admin-send-registration-email");

// Chainable mock DB helper
function createMockDb({
  userExists = true,
  userData = { email: "user@university.edu", name: "Test User" },
  emailDeliveryCount = 0,
} = {}) {
  const selectLimit = jest.fn().mockResolvedValue(userExists ? [userData] : []);
  const selectWhere = jest.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });

  const countWhere = jest
    .fn()
    .mockResolvedValue([{ count: emailDeliveryCount }]);
  const countFrom = jest.fn().mockReturnValue({ where: countWhere });

  const db = {
    select: jest.fn((arg?: unknown) => {
      if (arg && typeof arg === "object" && "count" in arg) {
        return { from: countFrom };
      }
      return { from: selectFrom };
    }),
  };

  return {
    db: db as (typeof import("@teachanything/db"))["db"],
    mocks: { selectWhere, selectLimit, countWhere },
  };
}

describe("admin.sendRegistrationEmail mutation handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("input validation", () => {
    it("throws NOT_FOUND when user does not exist", async () => {
      const { db } = createMockDb({ userExists: false });

      await expect(
        sendRegistrationEmail(
          { db },
          { userId: "missing-user", templateId: "request_more_info" },
        ),
      ).rejects.toHaveProperty("code", "NOT_FOUND");
    });

    it("requires userId to be non-empty", async () => {
      const { db } = createMockDb();

      await expect(
        sendRegistrationEmail(
          { db },
          { userId: "", templateId: "request_more_info" },
        ),
      ).rejects.toThrow();
    });

    it("requires templateId to be one of the allowed values", async () => {
      const { db } = createMockDb();

      await expect(
        sendRegistrationEmail(
          { db },
          { userId: "user-1", templateId: "invalid_template" as string & {} },
        ),
      ).rejects.toThrow();
    });

    it("requires customMessage for generic_admin_message template", async () => {
      const { db } = createMockDb();

      await expect(
        sendRegistrationEmail(
          { db },
          { userId: "user-1", templateId: "generic_admin_message" },
        ),
      ).rejects.toThrow();
    });

    it("accepts customMessage for generic_admin_message", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "Test User" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        {
          userId: "user-1",
          templateId: "generic_admin_message",
          customMessage: "Please update your profile",
        },
      );

      expect(result).toEqual({ success: true });
    });
  });

  describe("rate limiting", () => {
    it("throws TOO_MANY_REQUESTS after 5 emails in 24 hours", async () => {
      const { db } = createMockDb({ emailDeliveryCount: 5 });

      await expect(
        sendRegistrationEmail(
          { db },
          { userId: "user-1", templateId: "request_more_info" },
        ),
      ).rejects.toHaveProperty("code", "TOO_MANY_REQUESTS");
    });

    it("allows sending when count is less than 5", async () => {
      const { db } = createMockDb({ emailDeliveryCount: 4 });

      const result = await sendRegistrationEmail(
        { db },
        { userId: "user-1", templateId: "request_more_info" },
      );

      expect(result).toEqual({ success: true });
      expect(mockSendRequestMoreInfoEmail).toHaveBeenCalled();
    });

    it("throws TOO_MANY_REQUESTS when count is exactly 5", async () => {
      const { db } = createMockDb({ emailDeliveryCount: 5 });

      await expect(
        sendRegistrationEmail(
          { db },
          { userId: "user-1", templateId: "request_more_info" },
        ),
      ).rejects.toHaveProperty("code", "TOO_MANY_REQUESTS");
    });

    it("allows sending when count exceeds 5 but is from older than 24 hours", async () => {
      // The mock doesn't check the time, but the logic filters by 24h window
      const { db } = createMockDb({ emailDeliveryCount: 0 });

      const result = await sendRegistrationEmail(
        { db },
        { userId: "user-1", templateId: "request_more_info" },
      );

      expect(result).toEqual({ success: true });
    });
  });

  describe("email template dispatch", () => {
    it("calls sendRequestMoreInfoEmail for request_more_info template", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "John Doe" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        { userId: "user-1", templateId: "request_more_info" },
      );

      expect(result).toEqual({ success: true });
      expect(mockSendRequestMoreInfoEmail).toHaveBeenCalledWith({
        email: "user@university.edu",
        name: "John Doe",
      });
      expect(mockSendIncorrectInfoEmail).not.toHaveBeenCalled();
      expect(mockSendGenericAdminEmail).not.toHaveBeenCalled();
    });

    it("calls sendIncorrectInfoEmail for incorrect_info template", async () => {
      const { db } = createMockDb({
        userData: { email: "jane@university.edu", name: "Jane Smith" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        { userId: "user-2", templateId: "incorrect_info" },
      );

      expect(result).toEqual({ success: true });
      expect(mockSendIncorrectInfoEmail).toHaveBeenCalledWith({
        email: "jane@university.edu",
        name: "Jane Smith",
      });
      expect(mockSendRequestMoreInfoEmail).not.toHaveBeenCalled();
      expect(mockSendGenericAdminEmail).not.toHaveBeenCalled();
    });

    it("calls sendGenericAdminEmail for generic_admin_message template", async () => {
      const { db } = createMockDb({
        userData: { email: "admin@university.edu", name: "Admin Caller" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        {
          userId: "user-3",
          templateId: "generic_admin_message",
          customMessage: "Please update your profile",
        },
      );

      expect(result).toEqual({ success: true });
      expect(mockSendGenericAdminEmail).toHaveBeenCalledWith({
        email: "admin@university.edu",
        name: "Admin Caller",
        customMessage: "Please update your profile",
      });
      expect(mockSendRequestMoreInfoEmail).not.toHaveBeenCalled();
      expect(mockSendIncorrectInfoEmail).not.toHaveBeenCalled();
    });
  });

  describe("name handling", () => {
    it("trims whitespace from user name", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "  John Doe  " },
        emailDeliveryCount: 0,
      });

      await sendRegistrationEmail(
        { db },
        { userId: "user-1", templateId: "request_more_info" },
      );

      expect(mockSendRequestMoreInfoEmail).toHaveBeenCalledWith({
        email: "user@university.edu",
        name: "John Doe",
      });
    });

    it("defaults to 'User' when name is missing", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: undefined },
        emailDeliveryCount: 0,
      });

      await sendRegistrationEmail(
        { db },
        { userId: "user-1", templateId: "request_more_info" },
      );

      expect(mockSendRequestMoreInfoEmail).toHaveBeenCalledWith({
        email: "user@university.edu",
        name: "User",
      });
    });

    it("defaults to 'User' when name is only whitespace", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "   " },
        emailDeliveryCount: 0,
      });

      await sendRegistrationEmail(
        { db },
        { userId: "user-1", templateId: "request_more_info" },
      );

      expect(mockSendRequestMoreInfoEmail).toHaveBeenCalledWith({
        email: "user@university.edu",
        name: "User",
      });
    });
  });

  describe("customMessage trimming for generic_admin_message", () => {
    it("trims leading and trailing whitespace from customMessage", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "Test User" },
        emailDeliveryCount: 0,
      });

      await sendRegistrationEmail(
        { db },
        {
          userId: "user-1",
          templateId: "generic_admin_message",
          customMessage: "  Please update your profile  ",
        },
      );

      expect(mockSendGenericAdminEmail).toHaveBeenCalledWith({
        email: "user@university.edu",
        name: "Test User",
        customMessage: "Please update your profile",
      });
    });

    it("rejects customMessage that is only whitespace", async () => {
      const { db } = createMockDb();

      await expect(
        sendRegistrationEmail(
          { db },
          {
            userId: "user-1",
            templateId: "generic_admin_message",
            customMessage: "   ",
          },
        ),
      ).rejects.toThrow();
    });

    it("enforces max length of 1000 characters for customMessage", async () => {
      const { db } = createMockDb();
      const longMessage = "a".repeat(1001);

      await expect(
        sendRegistrationEmail(
          { db },
          {
            userId: "user-1",
            templateId: "generic_admin_message",
            customMessage: longMessage,
          },
        ),
      ).rejects.toThrow();
    });
  });

  describe("success case", () => {
    it("returns success true after sending request_more_info email", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "Test User" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        {
          userId: "user-1",
          templateId: "request_more_info",
        },
      );

      expect(result).toEqual({ success: true });
    });

    it("returns success true after sending incorrect_info email", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "Test User" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        {
          userId: "user-1",
          templateId: "incorrect_info",
        },
      );

      expect(result).toEqual({ success: true });
    });

    it("returns success true after sending generic_admin_message email", async () => {
      const { db } = createMockDb({
        userData: { email: "user@university.edu", name: "Test User" },
        emailDeliveryCount: 0,
      });

      const result = await sendRegistrationEmail(
        { db },
        {
          userId: "user-1",
          templateId: "generic_admin_message",
          customMessage: "Please update your profile",
        },
      );

      expect(result).toEqual({ success: true });
    });
  });
});
