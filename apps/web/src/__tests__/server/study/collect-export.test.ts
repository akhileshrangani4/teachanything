import { describe, it, expect } from "@jest/globals";
import {
  collectStudyTools,
  groupStudyResponses,
} from "@/server/study/collect-export";

const CONV = "conv-1";

// A persisted assistant quiz turn, shaped like metadata.parts in the DB:
// completeStudyToolPart upgrades the showQuiz call to output-available on save.
const quizPart = {
  type: "tool-showQuiz",
  toolCallId: "call_abc",
  state: "output-available",
  input: {
    quiz_title: "Cells",
    questions: [
      {
        question: "Powerhouse?",
        options: ["Nucleus", "Mitochondria"],
        correct_index: 1,
        explanation: "ATP.",
      },
    ],
  },
  output: "rendered",
};

describe("collectStudyTools + groupStudyResponses", () => {
  it("attaches the student's attempts to the quiz via toolCallId", () => {
    const responsesByKey = groupStudyResponses([
      {
        conversationId: CONV,
        toolCallId: "call_abc",
        attempt: 1,
        response: { answers: [0], score: 0, total: 1 },
      },
      {
        conversationId: CONV,
        toolCallId: "call_abc",
        attempt: 2,
        response: { answers: [1], score: 1, total: 1 },
      },
    ]);

    const tools = collectStudyTools([quizPart], CONV, responsesByKey);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.toolName).toBe("showQuiz");
    expect(tools[0]!.responses).toHaveLength(2);
    expect(tools[0]!.responses[0]).toEqual({
      attempt: 1,
      response: { answers: [0], score: 0, total: 1 },
    });
  });

  it("returns no attempts when nothing matches the toolCallId", () => {
    const responsesByKey = groupStudyResponses([
      {
        conversationId: CONV,
        toolCallId: "some-other-call",
        attempt: 1,
        response: { answers: [1], score: 1, total: 1 },
      },
    ]);
    const tools = collectStudyTools([quizPart], CONV, responsesByKey);
    expect(tools[0]!.responses).toHaveLength(0);
  });

  it("keeps a text part from hiding the quiz, and ignores non-tool parts", () => {
    const tools = collectStudyTools(
      [{ type: "text", text: "here's a quiz" }, quizPart],
      CONV,
      new Map(),
    );
    expect(tools).toHaveLength(1);
    expect(tools[0]!.toolName).toBe("showQuiz");
  });

  it("includes a persisted part even if it carries no state field", () => {
    const noState = { type: "tool-showQuiz", toolCallId: "c", input: {} };
    expect(collectStudyTools([noState], CONV, new Map())).toHaveLength(1);
  });

  it("skips streaming / errored tool parts", () => {
    const streaming = { type: "tool-showQuiz", state: "input-streaming" };
    const errored = { type: "tool-showQuiz", state: "output-error" };
    expect(
      collectStudyTools([streaming, errored], CONV, new Map()),
    ).toHaveLength(0);
  });
});
