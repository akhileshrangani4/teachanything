import { describe, it, expect } from "@jest/globals";
import { dailyLimitWarningCopy } from "@/lib/daily-limit-warning-copy";

describe("dailyLimitWarningCopy", () => {
  it.each([
    ["Biology", 80, 'Heads-up: "Biology" has used 80% of today\'s messages'],
    ["Biology", 100, '"Biology" has reached today\'s message limit'],
    [null, 80, "Heads-up: your chatbots have used 80% of today's messages"],
    [null, 100, "Your chatbots have reached today's message limit"],
  ] as const)(
    "subject for chatbot %p at %p%%",
    (chatbotName, threshold, expected) => {
      const count = threshold === 100 ? 150 : 120;
      expect(
        dailyLimitWarningCopy({ chatbotName, count, limit: 150, threshold })
          .subject,
      ).toBe(expected);
    },
  );

  it("words the chatbot 80% body", () => {
    expect(
      dailyLimitWarningCopy({
        chatbotName: "Biology",
        count: 120,
        limit: 150,
        threshold: 80,
      }),
    ).toMatchObject({
      usage:
        'Your chatbot "Biology" has received 120 of its 150 daily student messages today, 80% of the limit.',
      next: "The count resets at midnight US Eastern time.",
    });
  });

  it("words the professor-total 100% body", () => {
    expect(
      dailyLimitWarningCopy({
        chatbotName: null,
        count: 300,
        limit: 300,
        threshold: 100,
      }),
    ).toMatchObject({
      usage:
        "All of your chatbots together have reached your daily limit of 300 student messages.",
      next: "Students will see the daily-limit message until midnight US Eastern time, when the count resets.",
    });
  });

  it("shows the real share when 80% of the limit is not a whole number", () => {
    // A limit of 7 warns at 6 messages (80% of 7 is 5.6, rounded up).
    const copy = dailyLimitWarningCopy({
      chatbotName: "Biology",
      count: 6,
      limit: 7,
      threshold: 80,
    });
    expect(copy.subject).toBe(
      'Heads-up: "Biology" has used 86% of today\'s messages',
    );
    expect(copy.usage).toContain(
      "6 of its 7 daily student messages today, 86% of the limit.",
    );
  });
});
