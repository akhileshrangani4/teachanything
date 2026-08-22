import type { ExportFormat } from "./types";

export const FORMAT_FILENAMES: Record<ExportFormat, string> = {
  html: "chat-records.html",
  csv: "chat-records.csv",
  text: "chat-records.txt",
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  html: "Visual transcript (open in any web browser)",
  csv: "Spreadsheet (open in Excel / Google Sheets)",
  text: "Plain text (open in any text editor)",
};

// "Student" reads more clearly than "user" for the professor-facing export;
// the assistant is the chatbot's reply.
export function roleLabel(role: "user" | "assistant"): string {
  return role === "user" ? "Student" : "Assistant";
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function slugify(name: string): string {
  const slug = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return slug.toLowerCase() || "chatbot";
}

export function formatSimilarity(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * RFC-4180-style CSV cell: wrap in quotes and double any embedded quotes so
 * commas, quotes and newlines inside message content stay in one cell.
 *
 * Also guards against spreadsheet formula injection: a value starting with
 * `=`, `+`, `-`, `@` (or a leading tab/CR) makes Excel / Google Sheets treat
 * the cell as a formula. Prefixing with an apostrophe forces it to text; both
 * Excel and Sheets hide that apostrophe, so the professor still reads the
 * original content unchanged.
 */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Human-readable count helper: "1 conversation" / "3 conversations". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
