import { describe, it, expect } from "@jest/globals";
import { messageExportContent } from "@/lib/export-chat";

describe("messageExportContent", () => {
  it("returns the joined text for a normal message", () => {
    expect(
      messageExportContent({
        id: "m1",
        role: "assistant",
        parts: [
          { type: "text", text: "line one" },
          { type: "text", text: "line two" },
        ],
      } as never),
    ).toBe("line one\nline two");
  });

  it("substitutes a placeholder for a quiz-only turn (no text parts)", () => {
    // Otherwise the export writes a blank "[N] Assistant:" line.
    expect(
      messageExportContent({
        id: "m2",
        role: "assistant",
        parts: [
          {
            type: "tool-showQuiz",
            toolCallId: "c",
            state: "output-available",
            output: "rendered",
            input: { quiz_title: "Photosynthesis", questions: [] },
          },
        ],
      } as never),
    ).toBe("[Interactive quiz: Photosynthesis]");
  });
});
