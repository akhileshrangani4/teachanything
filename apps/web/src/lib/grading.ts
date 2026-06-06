/**
 * Client-side grade computation for Test Mode. Pure and dependency-free so it can
 * be unit-tested in isolation and reused by the results screen.
 */
export interface Grade {
  score: number;
  total: number;
  percentage: number; // 0-100, rounded to nearest integer
  letter: "A" | "B" | "C" | "D" | "F";
  passed: boolean; // percentage >= PASS_THRESHOLD
}

export const PASS_THRESHOLD = 60;

export function computeGrade(score: number, total: number): Grade {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const letter =
    percentage >= 90
      ? "A"
      : percentage >= 80
        ? "B"
        : percentage >= 70
          ? "C"
          : percentage >= 60
            ? "D"
            : "F";
  return {
    score,
    total,
    percentage,
    letter,
    passed: percentage >= PASS_THRESHOLD,
  };
}

/** A student's written answer to one open-ended test question. */
export interface OpenAnswer {
  question: string;
  answer: string;
}

/**
 * Build the plain-text chat message a student sends to have their written
 * (open-ended) test answers graded. The AI replies with feedback through the
 * normal chat stream, so this is just deterministic formatting. Answers whose
 * text is empty/whitespace are omitted. Returns null when nothing to grade.
 *
 * Note: we intentionally do NOT include the question "guidance" (the model's
 * crib of key points) in the message — let the model judge from the question.
 */
export function buildOpenAnswerReviewMessage(
  testTitle: string,
  answers: OpenAnswer[],
): string | null {
  const filled = answers.filter((a) => a.answer.trim().length > 0);
  if (filled.length === 0) return null;

  const body = filled
    .map((a, i) => `Q${i + 1}: ${a.question}\nMy answer: ${a.answer.trim()}`)
    .join("\n\n");

  return `Here are my written answers to the test "${testTitle}". Please grade each one and give me specific feedback on what I got right and how to improve.\n\n${body}`;
}
