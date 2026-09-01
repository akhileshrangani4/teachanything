import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

// Recreate the input schema used by the admin.sendRegistrationEmail procedure
// so we can unit-test the validation rules without invoking the router.
const sendRegistrationEmailInput = z
  .object({
    userId: z.string().min(1),
    templateId: z.enum([
      "request_more_info",
      "incorrect_info",
      "generic_admin_message",
    ]),
    customMessage: z.string().max(1000).optional(),
  })
  .refine(
    (data) =>
      data.templateId !== "generic_admin_message" ||
      !!data.customMessage?.trim(),
    {
      message: "Custom message is required for generic admin email",
      path: ["customMessage"],
    },
  );

describe("admin.sendRegistrationEmail Zod validation", () => {
  it("accepts valid request_more_info payload", () => {
    const input = { userId: "user-1", templateId: "request_more_info" };
    expect(() => sendRegistrationEmailInput.parse(input)).not.toThrow();
  });

  it("accepts valid incorrect_info payload", () => {
    const input = { userId: "user-1", templateId: "incorrect_info" };
    expect(() => sendRegistrationEmailInput.parse(input)).not.toThrow();
  });

  it("requires customMessage for generic_admin_message", () => {
    const input = { userId: "user-1", templateId: "generic_admin_message" };
    try {
      sendRegistrationEmailInput.parse(input);
      throw new Error("Expected ZodError");
    } catch (err) {
      expect(err).toBeInstanceOf(z.ZodError);
      const zerr = err as z.ZodError;
      // The refine sets the path to ['customMessage']
      const paths = zerr.issues.map((i) => i.path.join("."));
      expect(paths).toContain("customMessage");
      const messages = zerr.issues.map((i) => i.message);
      expect(
        messages.some((m) => m.includes("Custom message is required")),
      ).toBe(true);
    }
  });

  it("accepts generic_admin_message with non-empty customMessage", () => {
    const input = {
      userId: "user-1",
      templateId: "generic_admin_message",
      customMessage: " Please approve my account ",
    };
    expect(() => sendRegistrationEmailInput.parse(input)).not.toThrow();
  });

  it("rejects empty userId", () => {
    const input = { userId: "", templateId: "request_more_info" };
    expect(() => sendRegistrationEmailInput.parse(input)).toThrow();
  });

  it("rejects overly long customMessage (>1000 chars)", () => {
    const long = "a".repeat(1001);
    const input = {
      userId: "user-1",
      templateId: "generic_admin_message",
      customMessage: long,
    };
    expect(() => sendRegistrationEmailInput.parse(input)).toThrow();
  });

  it("rejects invalid templateId values", () => {
    // @ts-expect-error: testing invalid enum at runtime
    const input = { userId: "user-1", templateId: "not-a-template" };
    expect(() => sendRegistrationEmailInput.parse(input)).toThrow();
  });
});
