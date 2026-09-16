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

    it("falls back to the default when limit is out of range", () => {
      // Out of range is no longer fatal: ending a turn over a tuning knob
      // costs the student their question. "13" is over the max of 12 and "0"
      // under the min of 1, so both land on the default.
      expect(
        searchDocumentsInput.safeParse({ query: "q", limit: "13" }).data?.limit,
      ).toBe(6);
      expect(
        searchDocumentsInput.safeParse({ query: "q", limit: "0" }).data?.limit,
      ).toBe(6);
      expect(
        searchDocumentsInput.safeParse({ query: "q", limit: true }).data?.limit,
      ).toBe(6);
    });

    it("still refuses a search with no query", () => {
      // The fallback is on `limit` alone. A search without a query means
      // nothing, so there is nothing to recover to.
      expect(searchDocumentsInput.safeParse({}).success).toBe(false);
      expect(
        searchDocumentsInput.safeParse({ query: "", limit: 5 }).success,
      ).toBe(false);
    });
  });

  it("still asks the model for an integer in range", () => {
    // The recovery is on what we accept, never on what we ask for. The model
    // is still told limit is an integer from 1 to 12, so the fallback stays a
    // safety net rather than becoming the advertised contract. If this drifts
    // to `type: "string"` or loses its bounds, the model is being told it may
    // send anything, which is not the intent.
    const properties = (
      z.toJSONSchema(searchDocumentsInput, { io: "input" }) as {
        properties: Record<string, unknown>;
      }
    ).properties;

    expect(properties.limit).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 12,
    });
  });

  it("asks for the document reference as a plain string", () => {
    // Not `format: "uuid"`: the file manifest gives the model names, so a name
    // is a reference it can legitimately produce and the tool resolves it.
    const properties = (
      z.toJSONSchema(getPageInput, { io: "input" }) as {
        properties: Record<string, { type?: string; format?: string }>;
      }
    ).properties;

    expect(properties.fileId?.type).toBe("string");
    expect(properties.fileId?.format).toBeUndefined();
  });
});
