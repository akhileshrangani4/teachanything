/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import { describeChatError } from "@/lib/chat-error-message";

const CHATBOT_ID = "6f9619ff-8b86-4d11-b42d-00c04fc964ff";
const MESSAGE = { parts: [{ type: "text", text: "Hello" }] };

let authResult: unknown;
let isRateLimited: boolean;
let chatbot: unknown;
let streamFailure: Error | null;

const limiter = async () => ({ success: !isRateLimited });

jest.unstable_mockModule("@teachanything/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (chatbot ? [chatbot] : []) }),
      }),
    }),
  },
}));
jest.unstable_mockModule("@/lib/logger", () => ({ logError: jest.fn() }));
jest.unstable_mockModule("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));
jest.unstable_mockModule("@/lib/get-client-ip", () => ({
  getTrustedClientIp: () => "203.0.113.1",
}));
jest.unstable_mockModule("@/server/rate-limit", () => ({
  checkRateLimit: limiter,
  requireRateLimit: limiter,
  authenticatedChatRateLimit: null,
  publicChatRateLimit: null,
  publicChatGlobalRateLimit: null,
}));
jest.unstable_mockModule("@/server/api-auth", () => ({
  requireApprovedUser: async () => authResult,
}));
jest.unstable_mockModule("@/server/queries/chatbot", () => ({
  findChatbotForUser: async () => chatbot,
}));
jest.unstable_mockModule("@/server/chat/stream-chat", () => ({
  newSessionId: () => "session-1",
  streamChat: async () => {
    if (streamFailure) throw streamFailure;
    return new Response("stream");
  },
}));

const { ChatRequestError } = await import("@/server/chat/request");
const authed = await import("@/app/api/chat/route");
const shared = await import("@/app/api/chat/shared/route");

function request(body: unknown) {
  return new Request("http://test/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const authedBody = { message: MESSAGE, chatbotId: CHATBOT_ID };
const sharedBody = { message: MESSAGE, shareToken: "token" };
const emptyMessage = { parts: [{ type: "text", text: " " }] };

beforeEach(() => {
  authResult = { ok: true, user: { id: "user-1" } };
  isRateLimited = false;
  chatbot = { id: CHATBOT_ID };
  streamFailure = null;
});

async function expectError(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  await expect(res.json()).resolves.toEqual({ code });
}

describe("POST /api/chat errors", () => {
  it.each([
    ["unauthorized", 401],
    ["pending_approval", 403],
  ])("reports %s from the auth guard", async (code, status) => {
    authResult = { ok: false, code, response: new Response(null, { status }) };
    await expectError(await authed.POST(request(authedBody)), status, code);
  });

  it("reports the rate limit", async () => {
    isRateLimited = true;
    await expectError(
      await authed.POST(request(authedBody)),
      429,
      "rate_limited",
    );
  });

  it("reports an invalid request", async () => {
    await expectError(await authed.POST(request({})), 400, "invalid_request");
  });

  it("reports a message with no text", async () => {
    await expectError(
      await authed.POST(request({ ...authedBody, message: emptyMessage })),
      400,
      "message_needs_text",
    );
  });

  it("reports a missing chatbot", async () => {
    chatbot = undefined;
    await expectError(
      await authed.POST(request(authedBody)),
      404,
      "chatbot_not_found",
    );
  });

  it("reports a conversation that could not start", async () => {
    streamFailure = new ChatRequestError("conversation_start_failed", 409);
    await expectError(
      await authed.POST(request(authedBody)),
      409,
      "conversation_start_failed",
    );
  });

  it("reports a turn already in progress", async () => {
    streamFailure = new ChatRequestError("turn_in_progress", 409);
    await expectError(
      await authed.POST(request(authedBody)),
      409,
      "turn_in_progress",
    );
  });

  it("reports an unexpected failure", async () => {
    streamFailure = new Error("boom");
    await expectError(
      await authed.POST(request(authedBody)),
      500,
      "send_failed",
    );
  });
});

describe("POST /api/chat/shared errors", () => {
  it("reports an invalid request", async () => {
    await expectError(await shared.POST(request({})), 400, "invalid_request");
  });

  it("reports a message with no text", async () => {
    await expectError(
      await shared.POST(request({ ...sharedBody, message: emptyMessage })),
      400,
      "message_needs_text",
    );
  });

  it("reports the rate limit", async () => {
    isRateLimited = true;
    await expectError(
      await shared.POST(request(sharedBody)),
      429,
      "rate_limited",
    );
  });

  it("reports a chatbot that is not shared", async () => {
    chatbot = undefined;
    await expectError(
      await shared.POST(request(sharedBody)),
      404,
      "chatbot_not_shared",
    );
  });

  it("reports a conversation that could not start", async () => {
    streamFailure = new ChatRequestError("conversation_start_failed", 409);
    await expectError(
      await shared.POST(request(sharedBody)),
      409,
      "conversation_start_failed",
    );
  });

  it("reports a turn already in progress", async () => {
    streamFailure = new ChatRequestError("turn_in_progress", 409);
    await expectError(
      await shared.POST(request(sharedBody)),
      409,
      "turn_in_progress",
    );
  });

  it("reports an unexpected failure", async () => {
    streamFailure = new Error("boom");
    await expectError(
      await shared.POST(request(sharedBody)),
      500,
      "send_failed",
    );
  });
});

describe("a route error on the client", () => {
  it("reaches the user in their language", async () => {
    isRateLimited = true;
    const res = await authed.POST(request(authedBody));
    expect(
      describeChatError(
        new Error(await res.text()),
        createI18n("fr", fr, en).t,
      ),
    ).toBe(fr.errors.chat.tooManyMessages);
  });
});
