import { describe, it, expect } from "@jest/globals";
import {
  buildOpenAnswerReviewMessage,
  computeGrade,
  PASS_THRESHOLD,
} from "@/lib/grading";

describe("PASS_THRESHOLD", () => {
  it("is 60", () => {
    expect(PASS_THRESHOLD).toBe(60);
  });
});

describe("computeGrade", () => {
  it("10/10 → 100% → A, passed", () => {
    const grade = computeGrade(10, 10);
    expect(grade.percentage).toBe(100);
    expect(grade.letter).toBe("A");
    expect(grade.passed).toBe(true);
  });

  it("9/10 → 90% → A, passed", () => {
    const grade = computeGrade(9, 10);
    expect(grade.percentage).toBe(90);
    expect(grade.letter).toBe("A");
    expect(grade.passed).toBe(true);
  });

  it("89/100 → 89% → B, passed", () => {
    const grade = computeGrade(89, 100);
    expect(grade.percentage).toBe(89);
    expect(grade.letter).toBe("B");
    expect(grade.passed).toBe(true);
  });

  it("8/10 → 80% → B, passed", () => {
    const grade = computeGrade(8, 10);
    expect(grade.percentage).toBe(80);
    expect(grade.letter).toBe("B");
    expect(grade.passed).toBe(true);
  });

  it("7/10 → 70% → C, passed", () => {
    const grade = computeGrade(7, 10);
    expect(grade.percentage).toBe(70);
    expect(grade.letter).toBe("C");
    expect(grade.passed).toBe(true);
  });

  it("6/10 → 60% → D, passed (boundary: exactly PASS_THRESHOLD passes)", () => {
    const grade = computeGrade(6, 10);
    expect(grade.percentage).toBe(60);
    expect(grade.letter).toBe("D");
    expect(grade.passed).toBe(true);
  });

  it("59/100 → 59% → F, not passed", () => {
    const grade = computeGrade(59, 100);
    expect(grade.percentage).toBe(59);
    expect(grade.letter).toBe("F");
    expect(grade.passed).toBe(false);
  });

  it("5/10 → 50% → F, not passed", () => {
    const grade = computeGrade(5, 10);
    expect(grade.percentage).toBe(50);
    expect(grade.letter).toBe("F");
    expect(grade.passed).toBe(false);
  });

  it("0/10 → 0% → F, not passed", () => {
    const grade = computeGrade(0, 10);
    expect(grade.percentage).toBe(0);
    expect(grade.letter).toBe("F");
    expect(grade.passed).toBe(false);
  });

  it("0/0 → 0% → F, not passed (guards divide-by-zero)", () => {
    const grade = computeGrade(0, 0);
    expect(grade.percentage).toBe(0);
    expect(grade.letter).toBe("F");
    expect(grade.passed).toBe(false);
  });

  it("rounds percentage to nearest integer (2/3 → 67)", () => {
    const grade = computeGrade(2, 3);
    expect(grade.percentage).toBe(67);
  });

  it("preserves score and total in the result", () => {
    const grade = computeGrade(7, 10);
    expect(grade.score).toBe(7);
    expect(grade.total).toBe(10);
  });
});

describe("buildOpenAnswerReviewMessage", () => {
  it("returns null for an empty answers array", () => {
    expect(buildOpenAnswerReviewMessage("Some Test", [])).toBeNull();
  });

  it("returns null when every answer is empty or whitespace", () => {
    const message = buildOpenAnswerReviewMessage("Some Test", [
      { question: "Explain TCP.", answer: "" },
      { question: "Explain UDP.", answer: "   " },
      { question: "Explain DNS.", answer: "\n\t " },
    ]);
    expect(message).toBeNull();
  });

  it("omits empty answers, keeps filled ones, and renumbers from filled only", () => {
    const message = buildOpenAnswerReviewMessage("Networking Test", [
      { question: "What is a subnet mask?", answer: "" },
      {
        question: "Explain the three-way handshake.",
        answer: "SYN, SYN-ACK, then ACK to establish a TCP connection.",
      },
    ]);
    expect(message).not.toBeNull();
    expect(message).toContain("Explain the three-way handshake.");
    expect(message).not.toContain("What is a subnet mask?");
    // Only one filled answer, so numbering starts (and ends) at Q1.
    expect(message).toContain("Q1: Explain the three-way handshake.");
    expect(message).not.toContain("Q2:");
  });

  it("includes the test title, each filled question, and a 'My answer:' line", () => {
    const message = buildOpenAnswerReviewMessage("OSI Model Test", [
      {
        question: "Name the transport layer.",
        answer: "Layer 4.",
      },
      {
        question: "What does the network layer do?",
        answer: "Handles logical addressing and routing.",
      },
    ]);
    expect(message).not.toBeNull();
    expect(message).toContain("OSI Model Test");
    expect(message).toContain("Q1: Name the transport layer.");
    expect(message).toContain("My answer: Layer 4.");
    expect(message).toContain("Q2: What does the network layer do?");
    expect(message).toContain(
      "My answer: Handles logical addressing and routing.",
    );
  });

  it("contains the question and answer text and trims surrounding whitespace", () => {
    const message = buildOpenAnswerReviewMessage("Trim Test", [
      {
        question: "Describe encapsulation.",
        answer: "  Wrapping data with protocol headers.  ",
      },
    ]);
    expect(message).not.toBeNull();
    expect(message).toContain("Describe encapsulation.");
    expect(message).toContain(
      "My answer: Wrapping data with protocol headers.",
    );
    // Whitespace around the answer is trimmed in the output.
    expect(message).not.toContain("My answer:   Wrapping");
  });
});
