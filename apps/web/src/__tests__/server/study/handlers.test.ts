import { describe, it, expect } from "@jest/globals";
import {
  STUDY_TOOL_HANDLERS,
  isSupportedStudyTool,
} from "@/server/study/handlers";

const quiz = {
  quiz_title: "Photosynthesis",
  questions: [
    {
      question: "What gas do plants absorb?",
      options: ["CO2", "O2"],
      correct_index: 0,
      explanation: "Plants take in carbon dioxide.",
    },
    {
      question: "What do plants release?",
      options: ["CO2", "O2"],
      correct_index: 1,
      explanation: "They release oxygen.",
    },
  ],
};

describe("isSupportedStudyTool", () => {
  it("recognizes registered tools and rejects unknown ones", () => {
    expect(isSupportedStudyTool("showQuiz")).toBe(true);
    expect(isSupportedStudyTool("showFlashcards")).toBe(false);
  });
});

const handler = STUDY_TOOL_HANDLERS.showQuiz;
if (!handler) throw new Error("showQuiz handler is not registered");

describe("showQuiz handler.buildResponse", () => {
  it("grades valid answers server-side (ignoring any client score)", () => {
    expect(handler.buildResponse(quiz, { answers: [0, 1] })).toEqual({
      answers: [0, 1],
      score: 2,
      total: 2,
    });
    expect(handler.buildResponse(quiz, { answers: [1, 1] })).toEqual({
      answers: [1, 1],
      score: 1,
      total: 2,
    });
  });

  it("throws 400 when answers are the wrong length", () => {
    expect(() => handler.buildResponse(quiz, { answers: [0] })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("throws 400 when a selection is out of range", () => {
    expect(() => handler.buildResponse(quiz, { answers: [0, 5] })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("throws 400 on a non-array / malformed response", () => {
    expect(() => handler.buildResponse(quiz, {})).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(() => handler.buildResponse(quiz, null)).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("throws 404 when the shown input is not a valid quiz", () => {
    expect(() =>
      handler.buildResponse({ bogus: true }, { answers: [0, 1] }),
    ).toThrow(expect.objectContaining({ status: 404 }));
  });
});
