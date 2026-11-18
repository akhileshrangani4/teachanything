import { describe, it, expect } from "@jest/globals";
import { chatbotBlockedReason } from "@/components/admin/utils/chatbot-availability";

const available = {
  paused: false,
  ownerChatbotsPaused: false,
  isAtLimit: false,
  isOwnerAtLimit: false,
};

describe("chatbotBlockedReason", () => {
  it("is null when students can use the chatbot", () => {
    expect(chatbotBlockedReason(available)).toBeNull();
  });

  it.each([
    [{ isOwnerAtLimit: true }, "Professor limit reached"],
    [{ isAtLimit: true, isOwnerAtLimit: true }, "Limit reached"],
    [{ ownerChatbotsPaused: true, isAtLimit: true }, "Paused (all chatbots)"],
    [{ paused: true, ownerChatbotsPaused: true }, "Paused"],
  ])(
    "puts pauses before limits and the chatbot before its professor: %o",
    (state, reason) => {
      expect(chatbotBlockedReason({ ...available, ...state })).toBe(reason);
    },
  );
});
