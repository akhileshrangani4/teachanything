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

    it("keeps prose that merely mentions showQuiz() streaming as text", async () => {
      // The marker is broad on purpose, so an answer that talks about the tool
      // must be released as soon as its parens close without a quiz arg --
      // otherwise the rest of the answer stops streaming token by token.
      const input = textBlock("t1", [
        "I would call showQuiz() but there is no material ",
        "in this course to build a quiz from, sorry.",
      ]);
      const out = await pump(input);
      expect(out).toEqual(input);
    });

    it("still holds a pretty-printed pseudo-call whose args start on the next line", async () => {
      const call = `[showQuiz(\n  quiz_title="${quiz.quiz_title}",\n  questions=${JSON.stringify(quiz.questions)}\n)]`;
      const out = await pump(textBlock("t1", [preamble, call]));
      expect(out.at(-1)).toMatchObject({
        type: "tool-input-available",
        input: quiz,
      });
      expect(textOf(out)).toBe(preamble);
    });

    it("leaves a non-quiz JSON blob after prose as text", async () => {
      const input = textBlock("t1", [preamble, '{"foo":"bar"}']);
      const out = await pump(input);
      expect(out.some((c) => c.type === "tool-input-available")).toBe(false);
      expect(textOf(out)).toBe(textOf(input));
    });

    // The verbatim turn reported from production on 2026-08-07 (spacing and all),
    // as the strongest guard against regressing the case that was actually broken.
    it("recovers the reported production leak", async () => {
      const reported = `Here are some quiz questions to assess your understanding of the topics you've mentioned.

[showQuiz(quiz_title="Epistemologies of Gender Quiz", questions=[ { "question": "According to Professor Joubin's 'Five things about gender', what is the primary way gender shapes our society?", "options": [ "Gender is a fixed identity category.", "Gender is a set of evolving social practices.", "Gender is determined solely by biology.", "Gender is irrelevant to societal structures." ], "correct_index": 1, "explanation": "Professor Joubin emphasizes that gender is not an immutable identity category but rather a set of social practices that evolve over time." }, { "question": "Judith Butler argues that gender precedes sex assignment. What does this imply?", "options": [ "Gender is a direct result of biological sex.", "Sex assignment is independent of cultural frameworks.", "Gender influences how sex is assigned and categorized.", "Biological sex determines gender identity." ], "correct_index": 2, "explanation": "Butler suggests that gender is already operative as the scheme of power within which sex assignment takes place." }, { "question": "What is one of the main critiques of traditional understandings of gender epistemology?", "options": [ "That gender is too complex to be studied.", "That knowledge about gender is often biased.", "That gender should be determined solely by biological factors.", "That gender is not relevant to societal structures." ], "correct_index": 1, "explanation": "Systemic discourses about gender often foreclose the possibilities of marginalized narratives." } ])]`;
      // Split the way it really streams: many small deltas.
      const deltas: string[] = [];
      for (let i = 0; i < reported.length; i += 17) {
        deltas.push(reported.slice(i, i + 17));
      }
      const out = await pump(textBlock("t1", deltas));

      const toolPart = out.at(-1) as {
        type: string;
        toolName: string;
        input: { quiz_title: string; questions: unknown[] };
      };
      expect(toolPart.type).toBe("tool-input-available");
      expect(toolPart.toolName).toBe("showQuiz");
      expect(toolPart.input.quiz_title).toBe("Epistemologies of Gender Quiz");
      expect(toolPart.input.questions).toHaveLength(3);
      // The preamble is kept; the pseudo-call never reaches the client.
      expect(textOf(out)).toBe(
        "Here are some quiz questions to assess your understanding of the topics you've mentioned.\n\n",
      );
    });
  });
});

/**
 * The Critical Theory bot (Llama 4 Maverick) reported 2026-08-19: the leaked
 * call was well-formed enough to render, but `parseQuizFromText` demanded a
 * schema-perfect quiz, so the whole leak was flushed as text -- handing the
 * student a quiz with every answer and explanation already filled in.
 *
 * A leak must now recover on exactly the terms a native tool call does.
 */
describe("a leak that needs repairing", () => {
  const textOf = (chunks: Chunk[]) =>
    chunks
      .filter((c) => c.type === "text-delta")
      .map((c) => c.delta)
      .join("");

  const question = (i: number) => ({
    question: `Q${i}: how does Barbie stage gender as performance?`,
    options: ["A", "B", "C", "D"],
    correct_index: 1,
    explanation: `Because ${i}.`,
  });

  const pseudoCall = (questions: unknown) =>
    `[showQuiz(quiz_title="Gender Theory and Barbie", questions=${JSON.stringify(
      questions,
    )})]`;

  /** Split the way a leak really streams: many small deltas. */
  const deltasOf = (text: string, size = 17) => {
    const deltas: string[] = [];
    for (let i = 0; i < text.length; i += size)
      deltas.push(text.slice(i, i + size));
    return deltas;
  };

  const quizPartOf = (out: Chunk[]) =>
    out.find((c) => c.type === "tool-input-available") as
      | {
          toolName: string;
          input: { quiz_title: string; questions: unknown[] };
        }
      | undefined;

  it("recovers a six-question leak by trimming to the ceiling", async () => {
    const leak = pseudoCall([1, 2, 3, 4, 5, 6].map(question));
    const out = await pump(textBlock("t1", deltasOf(leak)));

    const part = quizPartOf(out);
    expect(part?.toolName).toBe("showQuiz");
    expect(part?.input.questions).toHaveLength(5);
    // The answer key must never reach the student as text.
    expect(textOf(out)).toBe("");
    expect(textOf(out)).not.toContain("correct_index");
  });

  it("recovers a leak whose answer key uses an alias", async () => {
    const leak = pseudoCall([
      {
        question: "Who wrote Gender Trouble?",
        options: ["Butler", "Foucault", "Sedgwick", "Ahmed"],
        answer: "A",
        explanation: "Judith Butler, 1990.",
      },
    ]);
    const out = await pump(textBlock("t1", deltasOf(leak)));

    expect(quizPartOf(out)?.input.questions[0]).toEqual(
      expect.objectContaining({ correct_index: 0 }),
    );
    expect(textOf(out)).toBe("");
  });

  it("keeps the preamble and recovers a leak cut off by the token limit", async () => {
    const full = `Here are 5 questions on the gender theory chapter.\n\n${pseudoCall(
      [1, 2, 3, 4, 5].map(question),
    )}`;
    const cutOff = full.slice(0, full.indexOf("Q3:") + 2);
    const out = await pump(textBlock("t1", deltasOf(cutOff)));

    expect(quizPartOf(out)?.input.questions).toHaveLength(2);
    expect(textOf(out)).toBe(
      "Here are 5 questions on the gender theory chapter.\n\n",
    );
    expect(textOf(out)).not.toContain("showQuiz(");
  });

  it("recovers a leak when the stream ends without text-end", async () => {
    // An aborted turn: `flush` used to dump the held leak as raw text.
    const leak = pseudoCall([1, 2].map(question));
    const out = await pump([
      { type: "text-start", id: "t1" },
      ...deltasOf(leak).map((delta) => ({
        type: "text-delta",
        id: "t1",
        delta,
      })),
    ]);

    expect(quizPartOf(out)?.input.questions).toHaveLength(2);
    expect(textOf(out)).toBe("");
  });
});
