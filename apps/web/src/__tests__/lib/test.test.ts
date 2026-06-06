import { describe, it, expect } from "@jest/globals";
import { isTestRequest, testSchema } from "@/lib/test-mode";

describe("isTestRequest", () => {
  it("matches common test phrasings", () => {
    const positives = [
      "test me",
      "Test me",
      "  TEST ME  ",
      "exam me",
      "examine me",
      "can you test me",
      "give me a test",
      "make me a test on networking",
      "create an exam",
      "start a test",
      "begin an exam",
      "generate a test",
    ];
    for (const message of positives) {
      expect(isTestRequest(message)).toBe(true);
    }
  });

  it("does not match unrelated messages", () => {
    const negatives = [
      "what is a test",
      "I failed my exam yesterday",
      "tell me about the syllabus",
      "the test page",
      "",
      "thanks!",
    ];
    for (const message of negatives) {
      expect(isTestRequest(message)).toBe(false);
    }
  });
});

describe("testSchema", () => {
  const makeQuestions = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      question: `Question ${i + 1}: what is ${i} + 1?`,
      options: ["wrong", `${i + 1}`, "also wrong", "nope"],
      correct_answer: `${i + 1}`,
      explanation: `${i} + 1 equals ${i + 1}.`,
    }));

  const validTest = {
    test_title: "Networking Fundamentals Test",
    questions: makeQuestions(8),
  };

  it("parses a well-formed test", () => {
    const result = testSchema.safeParse(validTest);
    expect(result.success).toBe(true);
  });

  it("rejects a test with no questions", () => {
    const result = testSchema.safeParse({
      test_title: "Empty",
      questions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a test with more than fifteen questions", () => {
    const result = testSchema.safeParse({
      test_title: "Too long",
      questions: makeQuestions(16),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question whose correct_answer is not among the options", () => {
    const result = testSchema.safeParse({
      test_title: "Broken answer",
      questions: [
        {
          question: "What is 2 + 2?",
          options: ["3", "5", "Error"],
          correct_answer: "4",
          explanation: "2 + 2 equals 4.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("parses a mixed test and retains type discriminants", () => {
    const result = testSchema.safeParse({
      test_title: "Mixed Test",
      questions: [
        {
          type: "multiple_choice",
          question: "Which protocol is connection-oriented?",
          options: ["UDP", "TCP", "ICMP"],
          correct_answer: "TCP",
          explanation: "TCP establishes a connection before sending data.",
        },
        {
          type: "open",
          question: "Explain the purpose of the OSI model in your own words.",
          guidance:
            "Layered abstraction, interoperability, separation of concerns.",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.questions[0].type).toBe("multiple_choice");
    expect(result.data.questions[1].type).toBe("open");
  });

  it("back-compat: a legacy MC question with no type field defaults to multiple_choice", () => {
    const result = testSchema.safeParse({
      test_title: "Legacy Test",
      questions: [
        {
          question: "What does DNS resolve?",
          options: ["Domain names to IPs", "IPs to MAC addresses"],
          correct_answer: "Domain names to IPs",
          explanation: "DNS maps human-readable names to IP addresses.",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.questions[0].type).toBe("multiple_choice");
  });

  it("rejects an open question missing guidance", () => {
    const result = testSchema.safeParse({
      test_title: "Bad open question",
      questions: [
        {
          type: "open",
          question: "Describe how routing works.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tagged MC question whose correct_answer is not among the options", () => {
    const result = testSchema.safeParse({
      test_title: "Broken tagged MC",
      questions: [
        {
          type: "multiple_choice",
          question: "What is 2 + 2?",
          options: ["3", "5", "Error"],
          correct_answer: "4",
          explanation: "2 + 2 equals 4.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
