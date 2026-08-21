import { describe, it, expect } from "@jest/globals";
import { parseQuizFromText } from "@/lib/quiz";
import { recoverLeakedQuiz } from "@/server/chat/recover-quiz";

type Chunk = Record<string, unknown>;

async function pump(chunks: Chunk[]): Promise<Chunk[]> {
  const stream = recoverLeakedQuiz();
  const writer = stream.writable.getWriter();
  const out: Chunk[] = [];
  const drained = (async () => {
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value as Chunk);
    }
  })();
  for (const chunk of chunks) await writer.write(chunk as never);
  await writer.close();
  await drained;
  return out;
}

const textOf = (chunks: Chunk[]) =>
  chunks
    .filter((c) => c.type === "text-delta")
    .map((c) => c.delta)
    .join("");

/**
 * `parseQuizFromText` was loosened to repair leaks the way the native tool-call
 * path does. That runs against EVERY tool-capable assistant turn, so the cost of
 * a false positive is high: prose would be swallowed and replaced by a bogus
 * quiz widget.
 *
 * These are answers a critical-theory or CS bot plausibly gives -- each contains
 * a brace, a fence, or the word showQuiz -- and every one must survive as text,
 * byte for byte, through the real stream transform.
 */
const NON_QUIZ_ANSWERS: Array<[string, string]> = [
  ["plain prose", "Butler argues that gender precedes sex assignment."],
  ["set notation", "Consider the set {a, b, c} and its powerset."],
  ["LaTeX fraction", "The ratio is \\frac{1}{2} of the total."],
  ["empty object in prose", "An empty config looks like {} in practice."],
  ["json config block", '```json\n{"model": "llama", "temperature": 0.7}\n```'],
  [
    "js code fence",
    '```js\nconst quiz = { title: "x" };\nexport default quiz;\n```',
  ],
  [
    "python fence",
    '```python\ndef grade(answers):\n    return {"score": 1}\n```',
  ],
  ["bare fence", "```\nplain preformatted text\n```"],
  [
    "mentions the tool by name",
    "I could call showQuiz() here, but you have not uploaded any readings yet.",
  ],
  [
    "explains the tool",
    "When you ask to be quizzed I call showQuiz(quiz_title=..., questions=[...]) internally.",
  ],
  [
    "quiz-shaped but missing a title",
    '{"questions": [{"question": "Q?", "options": ["a","b"], "correct_index": 0, "explanation": "e"}]}',
  ],
  [
    "quiz-shaped but no renderable question",
    '{"quiz_title": "T", "questions": [{"question": "Q?", "options": ["a","b"], "correct_index": 9, "explanation": "e"}]}',
  ],
  ["empty questions array", '{"quiz_title": "T", "questions": []}'],
  ["title only, no questions key", '{"quiz_title": "Gender Theory"}'],
  [
    "prose about a syllabus with braces",
    "The syllabus template uses {course_name} and {semester} as placeholders.",
  ],
  [
    "markdown table",
    "| Term | Meaning |\n|---|---|\n| performativity | gender as repeated acts |",
  ],
];

describe("leaked-quiz recovery does not eat ordinary answers", () => {
  it.each(NON_QUIZ_ANSWERS)("parseQuizFromText returns null: %s", (_, text) => {
    expect(parseQuizFromText(text)).toBeNull();
  });

  it.each(NON_QUIZ_ANSWERS)(
    "streams through byte-for-byte: %s",
    async (_, text) => {
      const out = await pump([
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: text },
        { type: "text-end", id: "t1" },
      ]);
      expect(textOf(out)).toBe(text);
      expect(out.some((c) => c.type === "tool-input-available")).toBe(false);
    },
  );

  it.each(NON_QUIZ_ANSWERS)(
    "survives delta-by-delta fragmentation: %s",
    async (_, text) => {
      // Split into 3-char deltas, the worst case for marker detection.
      const deltas: Chunk[] = [];
      for (let i = 0; i < text.length; i += 3) {
        deltas.push({
          type: "text-delta",
          id: "t1",
          delta: text.slice(i, i + 3),
        });
      }
      const out = await pump([
        { type: "text-start", id: "t1" },
        ...deltas,
        { type: "text-end", id: "t1" },
      ]);
      expect(textOf(out)).toBe(text);
      expect(out.some((c) => c.type === "tool-input-available")).toBe(false);
    },
  );
});
