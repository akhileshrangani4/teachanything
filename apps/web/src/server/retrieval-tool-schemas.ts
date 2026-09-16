import { z } from "zod";

/**
 * Zod input schemas for the agentic retrieval tools.
 *
 * Kept in a standalone module (no `ai` import) so they can be imported in unit
 * tests without pulling the AI SDK runtime — which depends on Web APIs like
 * `TransformStream` that are absent in the Jest/node test environment — into the
 * test process.
 */

/**
 * An integer field a MODEL fills in, rather than our own client.
 *
 * Models routinely send numbers as strings. GPT-OSS 120B called
 * `search_documents` with `{"query":"take-home midterm","limit":"5"}` in
 * production: the AI SDK validated it against a plain `z.number()`, threw
 * `AI_InvalidToolInputError`, and the student's whole chat turn died mid
 * stream. The model had done nothing unreasonable, it just quoted a number.
 *
 * Converting a numeric string is enough to absorb that. The check stays
 * deliberately narrow rather than using `z.coerce.number()`, because coercion
 * also turns `true` into 1 and would silently read chunk 1 instead of
 * rejecting a nonsense call. Everything that is not a non-empty string is left
 * to the number rules below, so `null`, `[]`, `true` and `"abc"` still fail.
 *
 * The JSON Schema the model is shown is unchanged, `{ type: "integer" }`
 * either way, so this widens what we accept without loosening what we ask for.
 */
const modelInt = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() !== "" ? Number(value) : value,
    schema,
  );

export const searchDocumentsInput = z.object({
  query: z.string().min(1).describe("Search terms or an exact quoted phrase"),
  fileId: z.string().uuid().optional().describe("Restrict to one document"),
  limit: modelInt(z.number().int().min(1).max(12)).optional(),
});

export const getPageInput = z.object({
  fileId: z.string().uuid(),
  pageNumber: modelInt(z.number().int().min(1)),
});

export const getContextAroundInput = z.object({
  fileId: z.string().uuid(),
  chunkIndex: modelInt(z.number().int().min(0)),
});
