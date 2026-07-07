import { z } from "zod";

/**
 * Zod input schemas for the agentic retrieval tools.
 *
 * Kept in a standalone module (no `ai` import) so they can be imported in unit
 * tests without pulling the AI SDK runtime — which depends on Web APIs like
 * `TransformStream` that are absent in the Jest/node test environment — into the
 * test process.
 */

export const searchDocumentsInput = z.object({
  query: z.string().min(1).describe("Search terms or an exact quoted phrase"),
  fileId: z.string().uuid().optional().describe("Restrict to one document"),
  limit: z.number().int().min(1).max(12).optional(),
});

export const getPageInput = z.object({
  fileId: z.string().uuid(),
  pageNumber: z.number().int().min(1),
});

export const getContextAroundInput = z.object({
  fileId: z.string().uuid(),
  chunkIndex: z.number().int().min(0),
});
