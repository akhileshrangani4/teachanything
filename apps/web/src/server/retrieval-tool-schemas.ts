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

/**
 * A document reference the MODEL supplies.
 *
 * Not `.uuid()`, deliberately. The system prompt's file manifest lists file
 * NAMES, so a model that reads it and passes "syllabus.pdf" here is following
 * the only identifier it was given. Rejecting that at the schema throws
 * `AI_InvalidToolInputError`, which ends the student's turn outright; the
 * tools resolve a name to its id instead, and answer with the document list
 * when they cannot. See `resolveFileId` in retrieval-tools.ts.
 */
const modelFileRef = z
  .string()
  .min(1)
  .describe("The fileId from list_documents, or the document's exact name");

export const searchDocumentsInput = z.object({
  query: z.string().min(1).describe("Search terms or an exact quoted phrase"),
  fileId: modelFileRef.optional().describe("Restrict to one document"),
  /**
   * `.catch` rather than a hard bound: a model asking for 50 passages has
   * made a harmless mistake, and falling back to the default beats ending the
   * turn over a tuning knob. The bound stays in the JSON Schema either way, so
   * the model is still told the real range, and `query` above keeps no
   * fallback because a search without one means nothing.
   */
  limit: modelInt(z.number().int().min(1).max(12))
    .optional()
    .catch(6)
    .describe("Passages to return, 1 to 12"),
});

/**
 * Page and chunk numbers get no fallback, deliberately. Quietly answering
 * about page 6 because the model asked for page 0 is a wrong citation
 * delivered confidently, which is worse than an error. They stay unbounded
 * here so the tool can return an explanation the model can act on, rather than
 * the SDK rejecting the call and ending the turn.
 */
export const getPageInput = z.object({
  fileId: modelFileRef,
  pageNumber: modelInt(z.number().int()).describe("1-based page number"),
});

export const getContextAroundInput = z.object({
  fileId: modelFileRef,
  chunkIndex: modelInt(z.number().int()).describe("0-based chunk index"),
});
