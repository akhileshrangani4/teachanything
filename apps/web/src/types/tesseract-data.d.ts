/**
 * Types for `@tesseract.js-data/eng`, which ships the English Tesseract model
 * and a tiny CommonJS entry point, but no type declarations.
 *
 * Deliberately duplicated at `packages/ai/src/tesseract-data.d.ts`, for the
 * same reason as `pdf-parse-lib.d.ts`: both projects type-check `image-ocr.ts`
 * and neither tsconfig includes the other's files. Keep the two in sync.
 */
declare module "@tesseract.js-data/eng" {
  const data: {
    /** Tesseract language code, "eng". */
    code: string;
    /** True: the model files are gzipped. */
    gzip: boolean;
    /** Absolute path of the package's default model directory. */
    langPath: string;
  };
  export default data;
}
