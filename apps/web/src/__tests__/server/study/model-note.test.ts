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
});
