import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // public/docs is the generated Blume docs site (see scripts/embed-docs.mjs);
  // never lint its bundled/minified output.
  { ignores: [".next/**", "__mocks__/**", "public/docs/**"] },
  ...nextJsConfig,
];
