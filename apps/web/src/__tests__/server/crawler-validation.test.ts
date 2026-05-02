import { describe, expect, it } from "@jest/globals";
import {
  allCrawlSourcesInput,
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
});
