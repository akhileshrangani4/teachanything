import { repairQuiz } from "@/lib/quiz";
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

/**
 * Finish a study-tool part for storage.
 *
 * A completed call (`input-available`) becomes `output-available`, which is what
 * makes it render on reload.
 *
 * A part still in `input-streaming` is a quiz the turn ended in the middle of --
 * a Stop, a disconnect, or the token limit -- and stored as-is it is the
 * "Building your quiz..." skeleton, which spins forever in history (see
 * `hasPersistableStudyPart`). Repair it into the questions that finished, the
 * same salvage the live stream applies via `closeTruncatedQuizInputs`. When
 * nothing is salvageable the part is left alone, so it stays non-persistable
 * rather than becoming a ghost row.
 *
 * `output-error` parts are left untouched: the student saw the error notice and
 * history should show what they saw.
 */
function completeStudyToolPart(
  part: StudyUIMessage["parts"][number],
): StudyUIMessage["parts"][number] {
  if (part.type !== "tool-showQuiz") return part;
  if (part.state === "input-available") {
    return {
      ...part,
      state: "output-available",
      output: "rendered",
    } as unknown as StudyUIMessage["parts"][number];
  }
  if (part.state === "input-streaming") {
    const quiz = repairQuiz(part.input);
    if (!quiz) return part;
    return {
      ...part,
      state: "output-available",
      input: quiz,
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

/**
 * True if `parts` contains a study-tool part that will actually render on
 * reload -- a completed (`output-available`) tool part. A part still stuck in
 * `input-streaming` (the turn timed out mid tool-input) or in `output-error` is
 * invisible/unrenderable, so it must not, on its own, cause an otherwise-empty
 * assistant turn to be persisted as a ghost row.
 */
export function hasPersistableStudyPart(
  parts: StudyUIMessage["parts"],
): boolean {
  return parts.some(
    (p) =>
      p.type.startsWith("tool-") &&
      "state" in p &&
      p.state === "output-available",
  );
}

/**
 * Down-convert study-tool parts to plain text for a model that can't use tools.
 *
 * If a chatbot is switched to a non-tool model mid-session, persisted history
 * can still contain completed `tool-showQuiz` parts. Feeding those through
 * `convertToModelMessages` emits provider tool-call / tool-result messages into
 * a request that declares no tools, which some providers reject with a 400 that
 * breaks every later turn. Replacing each quiz with a short text summary (and
 * dropping any other tool part) keeps the history readable with no tool-call
 * messages. Guarantees at least one part so an assistant turn is never empty.
 */
export function stripToolPartsForTextModel(
  msg: StudyUIMessage,
): StudyUIMessage {
  const parts = msg.parts.flatMap((p) => {
    if (!p.type.startsWith("tool-")) return [p];
    if (p.type === "tool-showQuiz") {
      const input = (p as { input?: { quiz_title?: unknown } }).input;
      const title =
        typeof input?.quiz_title === "string" ? input.quiz_title : "quiz";
      return [{ type: "text" as const, text: `[Interactive quiz: ${title}]` }];
    }
    return [];
  });
  return {
    ...msg,
    parts: parts.length > 0 ? parts : [{ type: "text", text: "" }],
  };
}
