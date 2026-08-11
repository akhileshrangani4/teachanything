import { describe, it, expect } from "@jest/globals";
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
  for (const chunk of chunks) {
    await writer.write(chunk as never);
  }
  await writer.close();
  await drained;
  return out;
}

/** Build the chunk sequence for one streamed text block. */
function textBlock(id: string, deltas: string[]): Chunk[] {
  return [
    { type: "text-start", id },
    ...deltas.map((delta) => ({ type: "text-delta", id, delta })),
    { type: "text-end", id },
  ];
}

const quiz = {
  quiz_title: "Photosynthesis",
  questions: [
    {
      question: "What gas do plants absorb?",
      options: ["CO2", "O2"],
      correct_index: 0,
      explanation: "Plants take in carbon dioxide.",
    },
  ],
};

describe("recoverLeakedQuiz", () => {
  it("streams ordinary prose through unchanged", async () => {
    const input = textBlock("t1", ["Here is ", "a summary."]);
    expect(await pump(input)).toEqual(input);
  });

  it("converts a leaked JSON quiz into a single showQuiz tool part", async () => {
    const out = await pump(textBlock("t1", [JSON.stringify(quiz)]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "tool-input-available",
      toolName: "showQuiz",
      input: quiz,
    });
    expect(typeof out[0]!.toolCallId).toBe("string");
    // The raw JSON text must not reach the client.
    expect(out.some((c) => c.type?.toString().startsWith("text"))).toBe(false);
  });

  it("recovers a quiz streamed across many deltas", async () => {
    const json = JSON.stringify(quiz);
    const deltas = [json.slice(0, 5), json.slice(5, 20), json.slice(20)];
    const out = await pump(textBlock("t1", deltas));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ toolName: "showQuiz", input: quiz });
  });

  it("recovers a quiz wrapped in a ```json fence", async () => {
    const fenced = "```json\n" + JSON.stringify(quiz) + "\n```";
    const out = await pump(textBlock("t1", [fenced]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ toolName: "showQuiz", input: quiz });
  });

  it("leaves a non-quiz JSON block as text", async () => {
    const input = textBlock("t1", ['{"foo":"bar"}']);
    expect(await pump(input)).toEqual(input);
  });

  it("streams a code-first answer (```js) through unchanged", async () => {
    // A code block in another language must not be buffered/held -- only quiz
    // JSON is. Split across deltas the way a fence really streams.
    const input = textBlock("t1", [
      "```js\n",
      "const x = { a: 1 };\n",
      "console.log(x);\n",
      "```",
    ]);
    expect(await pump(input)).toEqual(input);
  });

  it("recovers a quiz from a bare (language-less) ``` fence", async () => {
    const fenced = "```\n" + JSON.stringify(quiz) + "\n```";
    const out = await pump(textBlock("t1", [fenced]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ toolName: "showQuiz", input: quiz });
  });

  it("passes native tool-call chunks through untouched", async () => {
    const input: Chunk[] = [
      {
        type: "tool-input-available",
        toolCallId: "c1",
        toolName: "showQuiz",
        input: quiz,
      },
    ];
    expect(await pump(input)).toEqual(input);
  });

  it("flushes a held quiz-candidate block if the stream ends before text-end", async () => {
    // Stream cut off mid-JSON (no text-end): the partial text must not be lost.
    const partial = '{"quiz_title":"Photo';
    const input: Chunk[] = [
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: partial },
    ];
    expect(await pump(input)).toEqual(input);
  });

  it("streams prose that has leading whitespace", async () => {
    const input = textBlock("t1", ["   Hello there"]);
    expect(await pump(input)).toEqual(input);
  });

  /**
   * A leak does not have to start the text block. Models routinely write a
   * sentence of preamble ("Here are some quiz questions...") and then emit the
   * call, all inside one text block -- the shape reported in production
   * 2026-08-07. The preamble is a real answer and must still stream; only the
   * leaked call is replaced by the widget.
   */
  describe("leak after a prose preamble", () => {
    const preamble = "Here are some quiz questions for you.\n\n";

    const textOf = (chunks: Chunk[]) =>
      chunks
        .filter((c) => c.type === "text-delta")
        .map((c) => c.delta)
        .join("");

    it("recovers a JSON quiz that follows prose in the same block", async () => {
      const out = await pump(textBlock("t1", [preamble, JSON.stringify(quiz)]));
      expect(out.at(-1)).toMatchObject({
        type: "tool-input-available",
        toolName: "showQuiz",
        input: quiz,
      });
      // The preamble survives; the JSON does not.
      expect(textOf(out)).toBe(preamble);
    });

    it("recovers a pseudo-call that follows prose in the same block", async () => {
      const call = `[showQuiz(quiz_title="${quiz.quiz_title}", questions=${JSON.stringify(quiz.questions)})]`;
      const out = await pump(textBlock("t1", [preamble, call]));
      expect(out.at(-1)).toMatchObject({
        type: "tool-input-available",
        toolName: "showQuiz",
        input: quiz,
      });
      expect(textOf(out)).toBe(preamble);
    });

    it("recovers a leak split across deltas mid-marker", async () => {
      const call = `[showQuiz(quiz_title="${quiz.quiz_title}", questions=${JSON.stringify(quiz.questions)})]`;
      // Marker split so no single delta contains "showQuiz(" whole.
      const deltas = [
        preamble + "[show",
        "Quiz(quiz_",
        call.slice("[showQuiz(quiz_".length),
      ];
      const out = await pump(textBlock("t1", deltas));
      expect(out.at(-1)).toMatchObject({
        type: "tool-input-available",
        input: quiz,
      });
      expect(textOf(out)).toBe(preamble);
    });

    it("keeps prose containing braces streaming as text", async () => {
      // A brace in ordinary prose must not swallow the rest of the answer.
      const input = textBlock("t1", [
        "The empty set is written {a, b} ",
        "in most textbooks, and \\frac{1}{2} is a half.",
      ]);
      const out = await pump(input);
      expect(out.some((c) => c.type === "tool-input-available")).toBe(false);
      expect(textOf(out)).toBe(textOf(input));
    });

    it("leaves a non-quiz JSON blob after prose as text", async () => {
      const input = textBlock("t1", [preamble, '{"foo":"bar"}']);
      const out = await pump(input);
      expect(out.some((c) => c.type === "tool-input-available")).toBe(false);
      expect(textOf(out)).toBe(textOf(input));
    });
  });
});
