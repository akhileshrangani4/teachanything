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
});
