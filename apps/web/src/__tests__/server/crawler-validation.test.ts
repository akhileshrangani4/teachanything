import { describe, expect, it } from "@jest/globals";
import {
  allCrawlSourcesInput,
  crawlSourceInput,
  manualUrlInput,
  renameCrawledPageInput,
  renameCrawlSourceInput,
} from "@/server/routers/crawler/validation";

describe("crawler validation schemas", () => {
  describe("renameCrawlSourceInput", () => {
    it("accepts and trims valid source names", () => {
      const result = renameCrawlSourceInput.parse({
        crawlSourceId: "00000000-0000-4000-8000-000000000001",
        name: "  Winter's Tale Folger  ",
      });
      expect(result.name).toBe("Winter's Tale Folger");
    });

    it("rejects empty source names", () => {
      expect(() =>
        renameCrawlSourceInput.parse({
          crawlSourceId: "00000000-0000-4000-8000-000000000001",
          name: "   ",
        }),
      ).toThrow();
    });
  });

  describe("renameCrawledPageInput", () => {
    it("accepts and trims valid page titles", () => {
      const result = renameCrawledPageInput.parse({
        crawledPageId: "00000000-0000-4000-8000-000000000002",
        title: "  Winter's Tale full text  ",
      });
      expect(result.title).toBe("Winter's Tale full text");
    });

    it("rejects empty page titles", () => {
      expect(() =>
        renameCrawledPageInput.parse({
          crawledPageId: "00000000-0000-4000-8000-000000000002",
          title: "   ",
        }),
      ).toThrow();
    });
  });

  describe("allCrawlSourcesInput", () => {
    it("defaults pagination parameters", () => {
      expect(allCrawlSourcesInput.parse({})).toEqual({
        limit: 20,
        offset: 0,
      });
    });

    it("accepts valid pagination parameters", () => {
      expect(allCrawlSourcesInput.parse({ limit: 50, offset: 100 })).toEqual({
        limit: 50,
        offset: 100,
      });
    });

    it("rejects limits above the endpoint cap", () => {
      expect(() =>
        allCrawlSourcesInput.parse({ limit: 101, offset: 0 }),
      ).toThrow();
    });
  });

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
        manualUrlInput.parse({
          url: "https://example.com/page",
          chatbotId: "x",
        }),
      ).toThrow();
    });
  });
});
