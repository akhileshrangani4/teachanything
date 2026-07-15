import type { StudyUIMessage } from "./study-tools";

type MessageRow = {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
};

export const PARTS_VERSION = 1;

function isValidParts(value: unknown): value is StudyUIMessage["parts"] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { type?: unknown }).type === "string",
    )
  );
}

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
  const metadata = (row.metadata ?? {}) as {
    parts?: unknown;
    partsVersion?: number;
  } & StudyUIMessage["metadata"];
  const parts: StudyUIMessage["parts"] =
    metadata.partsVersion === PARTS_VERSION && isValidParts(metadata.parts)
      ? metadata.parts
      : [{ type: "text", text: row.content }];
  return {
    id: row.id,
    role: row.role as StudyUIMessage["role"],
    parts,
    metadata: {
      sources: metadata?.sources,
      responseTime: metadata?.responseTime,
      truncated: metadata?.truncated,
    },
  };
}

function completeStudyToolPart(
  part: StudyUIMessage["parts"][number],
): StudyUIMessage["parts"][number] {
  if (part.type === "tool-showQuiz" && part.state === "input-available") {
    return {
      ...part,
      state: "output-available",
      output: "rendered",
    } as unknown as StudyUIMessage["parts"][number];
  }
  return part;
}

/** Split a generated assistant UIMessage into the `content` + `parts` we store. */
export function assistantMessageForDb(msg: StudyUIMessage): {
  content: string;
  parts: StudyUIMessage["parts"];
} {
  return {
    content: extractText(msg.parts),
    parts: msg.parts.map(completeStudyToolPart),
  };
}
