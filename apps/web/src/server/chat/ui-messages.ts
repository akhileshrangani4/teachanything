import type { StudyUIMessage } from "./study-tools";

type MessageRow = {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
};

/** Concatenate the text of all `text` parts (newline-joined). */
export function extractText(parts: StudyUIMessage["parts"]): string {
  return parts
    .filter(
      (p): p is Extract<StudyUIMessage["parts"][number], { type: "text" }> =>
        p.type === "text",
    )
    .map((p) => p.text)
    .join("\n");
}

/**
 * Rehydrate a DB message row into a UIMessage. Tool messages restore their
 * `parts` from `metadata.parts`; legacy text rows fall back to a single text
 * part built from `content`.
 */
export function rowToUIMessage(row: MessageRow): StudyUIMessage {
  const metadata = (row.metadata ?? {}) as { parts?: unknown[] };
  const parts = (metadata.parts as StudyUIMessage["parts"] | undefined) ?? [
    { type: "text", text: row.content },
  ];
  return {
    id: row.id,
    role: row.role as StudyUIMessage["role"],
    parts,
  };
}

/** Split a generated assistant UIMessage into the `content` + `parts` we store. */
export function assistantMessageForDb(msg: StudyUIMessage): {
  content: string;
  parts: StudyUIMessage["parts"];
} {
  return { content: extractText(msg.parts), parts: msg.parts };
}
