import { describe, it, expect } from "@jest/globals";
import {
  buildStudyResultsNote,
  type StoredStudyResponse,
} from "@/server/study/model-note";
import type { StudyUIMessage } from "@/server/chat/study-tools";

function assistantWithQuiz(
  toolCallId: string,
  quizTitle: string,
): StudyUIMessage {
  return {
    id: `m-${toolCallId}`,
    role: "assistant",
    parts: [
      {
        type: "tool-showQuiz",
        toolCallId,
        state: "output-available",
        input: { quiz_title: quizTitle, questions: [] },
        output: "rendered",
      },
    ],
  } as unknown as StudyUIMessage;
}

describe("buildStudyResultsNote", () => {
  it("returns empty string when no study tools were shown", () => {
    const history: StudyUIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
    ] as unknown as StudyUIMessage[];
    expect(buildStudyResultsNote(history, new Map())).toBe("");
  });

  it("summarizes each attempt's score for an answered quiz", () => {
    const history = [assistantWithQuiz("c1", "Photosynthesis")];
    const responses = new Map<string, StoredStudyResponse[]>([
      [
        "c1",
        [
          { toolName: "showQuiz", response: { score: 2, total: 5 } },
          { toolName: "showQuiz", response: { score: 4, total: 5 } },
        ],
      ],
    ]);
    const note = buildStudyResultsNote(history, responses);
    expect(note).toContain('"Photosynthesis" quiz');
    expect(note).toContain("attempt 1 scored 2/5");
    expect(note).toContain("attempt 2 scored 4/5");
  });

  it("flags a quiz that was shown but not answered", () => {
    const history = [assistantWithQuiz("c2", "Cell Division")];
    const note = buildStudyResultsNote(history, new Map());
    expect(note).toContain('"Cell Division" quiz');
    expect(note).toContain("have not answered it yet");
  });

  it("ignores parts that never finished rendering (input-streaming)", () => {
    // A part persisted mid-input-streaming (interrupted turn) was never shown
    // as an interactive widget; reporting it as "shown" would mislead the model.
    const history = [
      {
        id: "m-ghost",
        role: "assistant",
        parts: [
          {
            type: "tool-showQuiz",
            toolCallId: "c3",
            state: "input-streaming",
            input: { quiz_title: "Ghost", questions: [] },
          },
        ],
      },
    ] as unknown as StudyUIMessage[];
    expect(buildStudyResultsNote(history, new Map())).toBe("");
  });

  it("caps the attempts shown per tool and notes the omission", () => {
    const history = [assistantWithQuiz("c4", "Marathon")];
    const responses = new Map<string, StoredStudyResponse[]>([
      [
        "c4",
        Array.from({ length: 13 }, (_, i) => ({
          toolName: "showQuiz",
          response: { score: i, total: 13 },
        })),
      ],
    ]);
    const note = buildStudyResultsNote(history, responses);
    expect(note).toContain("(3 earlier attempts omitted)");
    expect(note).not.toContain("attempt 3 "); // oldest omitted
    expect(note).toContain("attempt 4 scored 3/13"); // window starts here
    expect(note).toContain("attempt 13 scored 12/13"); // latest kept
  });
});

describe("buildStudyResultsNote attempt detail", () => {
  const quiz = {
    quiz_title: "Tempest",
    questions: [
      {
        question: "First question?",
        options: ["right", "wrong"],
        correct_index: 0,
        explanation: "x",
      },
    ],
  };
  const history = [
    {
      id: "m1",
      role: "assistant" as const,
      parts: [
        {
          type: "tool-showQuiz",
          toolCallId: "c1",
          state: "output-available",
          output: "rendered",
          input: quiz,
        },
      ],
    },
  ] as never;

  it("details only the latest attempt, keeping earlier ones score-only", () => {
    const note = buildStudyResultsNote(
      history,
      new Map([
        [
          "c1",
          [
            {
              toolName: "showQuiz",
              response: { score: 0, total: 1, answers: [1] },
            },
            {
              toolName: "showQuiz",
              response: { score: 0, total: 1, answers: [1] },
            },
          ],
        ],
      ]),
    );
    // Two attempts, but only one spelled-out miss: the most recent.
    expect(note).toContain("attempt 1 scored 0/1;");
    expect(note.match(/they chose/g)).toHaveLength(1);
    expect(note).toContain("attempt 2 scored 0/1; missed");
  });
});
