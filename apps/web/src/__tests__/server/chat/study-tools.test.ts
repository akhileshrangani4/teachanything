import { describe, it, expect } from "@jest/globals";
import { studyTools } from "@/server/chat/study-tools";

describe("studyTools", () => {
  it("registers showQuiz with the quiz schema and no execute", () => {
    expect(studyTools.showQuiz).toBeDefined();
    expect(studyTools.showQuiz.inputSchema).toBeDefined();
    // Render-only tool: no server-side execute.
    expect(studyTools.showQuiz.execute).toBeUndefined();
  });

  it("showQuiz inputSchema validates a quiz payload", () => {
    const parsed = studyTools.showQuiz.inputSchema.safeParse({
      quiz_title: "T",
      questions: [
        {
          question: "Q?",
          options: ["A", "B"],
          correct_answer: "A",
          explanation: "x",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
