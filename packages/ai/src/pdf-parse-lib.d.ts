/**
 * Types for the `pdf-parse/lib/pdf-parse.js` subpath.
 *
 * `@types/pdf-parse` declares only the package root, but the root is exactly
 * what must not be imported: its `!module.parent` debug block crashes under ESM
 * (see the note in `RAGService.extractPDF`). `lib/pdf-parse.js` is the parser
 * the root re-exports, so it takes the same arguments and returns the same
 * shape -- borrow the root's declaration rather than restating it.
 *
 * Deliberately duplicated at `apps/web/src/types/pdf-parse-lib.d.ts`. Both
 * projects type-check `rag-service.ts` (the web app compiles this package's
 * source directly), and neither tsconfig includes the other's files, so an
 * ambient declaration in one is invisible to the other. Keep the two in sync.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  import type PdfParse from "pdf-parse";

  const pdfParse: typeof PdfParse;
  export default pdfParse;
}
