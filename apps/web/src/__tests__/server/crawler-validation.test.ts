import { describe, it, expect } from "@jest/globals";
import {
  crawlSourceInput,
  manualUrlInput,
} from "@/server/routers/crawler/validation";

describe("crawlSourceInput", () => {
  it("accepts input with no chatbotId (unattached source)", () => {
    const parsed = crawlSourceInput.parse({ rootUrl: "https://example.com" });
    expect(parsed.chatbotId).toBeUndefined();
    expect(parsed.crawlDepth).toBe(3);
  });

  it("accepts a valid chatbotId", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const parsed = crawlSourceInput.parse({
      rootUrl: "https://example.com",
      chatbotId: id,
    });
    expect(parsed.chatbotId).toBe(id);
  });

  it("rejects a malformed chatbotId", () => {
    expect(() =>
      crawlSourceInput.parse({
        rootUrl: "https://example.com",
        chatbotId: "not-a-uuid",
      }),
    ).toThrow();
  });
});

describe("manualUrlInput", () => {
  it("accepts input with no chatbotId", () => {
    const parsed = manualUrlInput.parse({ url: "https://example.com/page" });
    expect(parsed.chatbotId).toBeUndefined();
  });

  it("rejects a malformed chatbotId", () => {
    expect(() =>
      manualUrlInput.parse({ url: "https://example.com/page", chatbotId: "x" }),
    ).toThrow();
  });
});
