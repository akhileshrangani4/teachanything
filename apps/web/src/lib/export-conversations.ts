/**
 * Turns a chatbot's exported chat records (from
 * `analytics.exportConversations`) into downloadable files. The professor
 * picks any combination of HTML / CSV / plain text in the Student Chats tab;
 * we always add a README that documents *only* the formats they chose, then
 * bundle everything into a single .zip download.
 *
 * The builders are pure (data in, string out) so they can be unit-tested
 * without a DOM. Only `downloadConversationsExport` touches the browser.
 * Implementation lives in focused modules under `lib/export-conversations/`;
 * this file is the public entry point so `@/lib/export-conversations` imports
 * keep working unchanged.
 */
export type {
  ConversationsExport,
  ExportConversation,
  ExportFormat,
  ExportMessage,
  ExportSource,
  ExportStudyTool,
} from "./export-conversations/types";
export { buildText } from "./export-conversations/build-text";
export { buildCsv } from "./export-conversations/build-csv";
export { buildHtml } from "./export-conversations/build-html";
export { buildInstructions } from "./export-conversations/instructions";
export {
  buildExportFiles,
  downloadConversationsExport,
} from "./export-conversations/bundle";
