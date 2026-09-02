import { strToU8, zipSync } from "fflate";
import type { ConversationsExport, ExportFormat } from "./types";
import { FORMAT_FILENAMES, slugify } from "./format-helpers";
import { buildText } from "./build-text";
import { buildCsv } from "./build-csv";
import { buildHtml } from "./build-html";
import { buildInstructions } from "./instructions";

/**
 * Builds the file map for the bundle: one file per chosen format plus a
 * README that documents exactly those formats. Returns filename -> contents.
 */
export function buildExportFiles(
  data: ConversationsExport,
  formats: ExportFormat[],
): Record<string, string> {
  const files: Record<string, string> = {};
  if (formats.includes("html")) files[FORMAT_FILENAMES.html] = buildHtml(data);
  if (formats.includes("csv")) files[FORMAT_FILENAMES.csv] = buildCsv(data);
  if (formats.includes("text")) files[FORMAT_FILENAMES.text] = buildText(data);
  files["README.txt"] = buildInstructions(data, formats);
  return files;
}

/**
 * Builds the chosen files, zips them (fflate, in-memory), and triggers a
 * browser download of a single .zip. No-op outside the browser.
 */
export function downloadConversationsExport(
  data: ConversationsExport,
  formats: ExportFormat[],
): void {
  if (typeof document === "undefined") return;
  if (formats.length === 0) return;

  const files = buildExportFiles(data, formats);
  const zipInput: Record<string, Uint8Array> = {};
  for (const [name, contents] of Object.entries(files)) {
    zipInput[name] = strToU8(contents);
  }

  const zipped = zipSync(zipInput);
  // Copy into a fresh Uint8Array so the Blob gets a plain ArrayBuffer (not
  // fflate's possibly-pooled buffer view).
  const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chat-records-${slugify(data.chatbotName)}-${Date.now()}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
