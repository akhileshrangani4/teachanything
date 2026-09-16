import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

import {
  searchDocumentsInput,
  getPageInput,
  getContextAroundInput,
} from "@/server/retrieval-tool-schemas";

/**
 * Models quote numbers. GPT-OSS 120B called `search_documents` with
 * `{"query":"take-home midterm","limit":"5"}` in production; the AI SDK
 * validated it, threw `AI_InvalidToolInputError`, and the student's chat turn
 * died mid stream. These pin the narrow widening that absorbs that, and the
 * inputs it still has to refuse.
 */

const FILE_ID = "6f0a5c2e-7b7b-4c5a-9b4a-2f1d3e4c5a6b";

describe("retrieval tool inputs", () => {
  describe("numeric strings from the model", () => {
    it("accepts the exact call that failed in production", () => {
      const result = searchDocumentsInput.safeParse({
        query: "take-home midterm",
        limit: "5",
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(5);
    });

    it("converts quoted integers on every model-filled field", () => {
      expect(
        getPageInput.safeParse({ fileId: FILE_ID, pageNumber: "3" }).data
          ?.pageNumber,
      ).toBe(3);

      expect(
        getContextAroundInput.safeParse({ fileId: FILE_ID, chunkIndex: "0" })
          .data?.chunkIndex,
      ).toBe(0);
    });

    it("still accepts real numbers", () => {
      expect(
        searchDocumentsInput.safeParse({ query: "q", limit: 5 }).data?.limit,
      ).toBe(5);
      expect(
        getPageInput.safeParse({ fileId: FILE_ID, pageNumber: 3 }).data
          ?.pageNumber,
      ).toBe(3);
    });

    it("leaves an omitted limit alone", () => {
      const result = searchDocumentsInput.safeParse({ query: "q" });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBeUndefined();
    });
  });

  describe("inputs that must still be refused", () => {
    // The reason this is `z.preprocess` and not `z.coerce.number()`: coercion
    // turns `true` into 1 and `[]` into 0, so a nonsense call would quietly
    // read chunk 1 or page 1 instead of failing.
    it.each([
      ["a boolean", true],
      ["null", null],
      ["an empty string", ""],
      ["whitespace", "   "],
      ["an array", []],
      ["a non-numeric string", "five"],
      ["a decimal string", "2.5"],
    ])("rejects %s for chunkIndex", (_label, value) => {
      expect(
        getContextAroundInput.safeParse({ fileId: FILE_ID, chunkIndex: value })
          .success,
      ).toBe(false);
    });

    it("keeps the range bounds when the value arrives as a string", () => {
      // "13" is over the max of 12, "0" is under the min of 1.
      expect(
        searchDocumentsInput.safeParse({ query: "q", limit: "13" }).success,
      ).toBe(false);
      expect(
        searchDocumentsInput.safeParse({ query: "q", limit: "0" }).success,
      ).toBe(false);
    });
  });

  it("shows the model an unchanged contract", () => {
    // The widening is on what we accept, not on what we ask for. If this
    // drifts, the model is being told it may send a string, which is not the
    // intent.
    const properties = (
      z.toJSONSchema(searchDocumentsInput, { io: "input" }) as {
        properties: Record<string, unknown>;
      }
    ).properties;

    expect(properties.limit).toEqual({
      type: "integer",
      minimum: 1,
      maximum: 12,
    });
  });
});
