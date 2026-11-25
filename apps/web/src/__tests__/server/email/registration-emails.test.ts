/**
 * @jest-environment node
 *
 * The three registration email wrappers: what they hand to queueEmail (subject,
 * reply-to, audit metadata) and what the rendered email actually contains.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

type QueueParams = {
  emailType: string;
  to: string;
  subject: string;
  reactComponent: ReactElement;
  replyTo?: string;
  metadata?: Record<string, unknown>;
};
const mockQueueEmail =
  jest.fn<(p: QueueParams) => Promise<{ deliveryId: string }>>();

jest.unstable_mockModule("@/server/email/delivery", () => ({
  queueEmail: mockQueueEmail,
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

const {
  sendRequestMoreInfoEmail,
  sendIncorrectInfoEmail,
  sendGenericAdminEmail,
} = await import("@/server/email/registration-emails");
const { REGISTRATION_EMAIL_TEMPLATES, REGISTRATION_EMAIL_BODIES } =
  await import("@/lib/registration-email-templates");

const recipient = {
  email: "pending@test.edu",
  name: "Dana Lee",
  sentByAdminId: "admin-1",
};

function lastQueued(): QueueParams {
  const call = mockQueueEmail.mock.calls.at(-1);
  if (!call) throw new Error("queueEmail was not called");
  return call[0];
}

beforeEach(() => {
  mockQueueEmail.mockResolvedValue({ deliveryId: "d-1" });
});

describe("registration email wrappers", () => {
  it.each([
    ["request_more_info", () => sendRequestMoreInfoEmail(recipient)],
    ["incorrect_info", () => sendIncorrectInfoEmail(recipient)],
  ] as const)(
    "%s uses the shared subject, a reply-to, and records the sender",
    async (templateId, send) => {
      await send();
      const queued = lastQueued();
      expect(queued.emailType).toBe(templateId);
      expect(queued.to).toBe("pending@test.edu");
      expect(queued.subject).toBe(
        REGISTRATION_EMAIL_TEMPLATES[templateId].subject,
      );
      expect(queued.replyTo).toBeTruthy();
      expect(queued.metadata).toEqual({ sentByAdminId: "admin-1", templateId });
    },
  );

  it("records the custom message and its sender", async () => {
    await sendGenericAdminEmail({ ...recipient, customMessage: "Hello" });
    const queued = lastQueued();
    expect(queued.subject).toBe(
      REGISTRATION_EMAIL_TEMPLATES.generic_admin_message.subject,
    );
    expect(queued.metadata).toEqual({
      sentByAdminId: "admin-1",
      templateId: "generic_admin_message",
      customMessage: "Hello",
    });
  });
});

describe("rendered registration emails", () => {
  it.each([
    ["request_more_info", () => sendRequestMoreInfoEmail(recipient)],
    ["incorrect_info", () => sendIncorrectInfoEmail(recipient)],
  ] as const)(
    "%s asks for a reply with the missing details",
    async (_templateId, send) => {
      await send();
      const queued = lastQueued();
      const html = await render(queued.reactComponent);
      expect(html).toContain("Dana Lee");
      expect(html).toContain("institutional affiliation");
      expect(html).toContain("Teach Anything®");
      expect(html).not.toContain("™");
      // Replies work (replyTo is set), so the footer must not say otherwise.
      expect(html).not.toMatch(/do not reply/i);
      expect(html).toContain(`mailto:${queued.replyTo}`);
    },
  );

  it.each([
    ["request_more_info", () => sendRequestMoreInfoEmail(recipient)],
    ["incorrect_info", () => sendIncorrectInfoEmail(recipient)],
  ] as const)(
    "%s sends exactly the text the admin dialog previews",
    async (templateId, send) => {
      await send();
      const html = await render(lastQueued().reactComponent);
      const body = REGISTRATION_EMAIL_BODIES[templateId];
      for (const line of [
        body.intro,
        body.request,
        ...body.items,
        body.closing,
      ]) {
        expect(html).toContain(line);
      }
    },
  );

  it("escapes markup in the custom message and keeps its line breaks", async () => {
    await sendGenericAdminEmail({
      ...recipient,
      customMessage: '<script>alert("x")</script> Q&A\n\nSecond paragraph',
    });
    const html = await render(lastQueued().reactComponent);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Q&amp;A");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("Second paragraph");
  });
});
