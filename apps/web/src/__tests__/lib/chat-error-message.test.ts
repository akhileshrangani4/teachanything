import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import { describeChatError } from "@/lib/chat-error-message";

const english = createI18n("en", en);
const french = createI18n("fr", fr, en);

function bodyWithCode(code: string) {
  return new Error(JSON.stringify({ code }));
}

describe("describeChatError", () => {
  it.each([
    ["rate_limited", fr.errors.chat.tooManyMessages],
    ["invalid_request", fr.errors.chat.invalidRequest],
    ["message_needs_text", fr.errors.chat.messageNeedsText],
    ["conversation_start_failed", fr.errors.chat.conversationStartFailed],
    ["unauthorized", fr.errors.chat.unauthorized],
    ["pending_approval", fr.errors.pendingApproval],
    ["chatbot_not_found", fr.errors.notFoundItems.chatbot],
    ["chatbot_not_shared", fr.errors.notFoundItems.chatbotNotShared],
    ["send_failed", fr.errors.chat.sendFailed],
  ])("translates the route code %s", (code, expected) => {
    expect(describeChatError(bodyWithCode(code), french.t)).toBe(expected);
  });

  it.each(["{}", '{"code":"unknown"}', '{"code":"toString"}', '{"code":1}'])(
    "replaces the unusable body %s with the generic message",
    (body) => {
      expect(describeChatError(new Error(body), english.t)).toBe(
        en.errors.chat.sendFailed,
      );
    },
  );

  it("keeps a short plain message", () => {
    expect(describeChatError(new Error("Network down"), english.t)).toBe(
      "Network down",
    );
  });
});
