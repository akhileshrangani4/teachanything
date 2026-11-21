import type { LimitWarningThreshold } from "@/lib/constants/rate-limits";

/** What a daily limit warning email reports. */
export type LimitWarningFacts = {
  /** The chatbot whose own limit this is; null for the professor's total. */
  chatbotName: string | null;
  count: number;
  limit: number;
  threshold: LimitWarningThreshold;
};

/**
 * The warning email's wording. `usage` and `next` are the body's two key
 * sentences, each one string so it renders as a single text node.
 */
export type LimitWarningCopy = { subject: string; usage: string; next: string };

/** How the email names whose limit it is, for the chatbot or the total. */
function scopeWords(chatbotName: string | null) {
  if (chatbotName === null) {
    return {
      sentence: "All of your chatbots together have",
      subject: "your chatbots have",
      whose: "your",
    };
  }
  return {
    sentence: `Your chatbot "${chatbotName}" has`,
    subject: `"${chatbotName}" has`,
    whose: "its",
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The subject and body sentences for one limit warning email. */
export function dailyLimitWarningCopy(
  facts: LimitWarningFacts,
): LimitWarningCopy {
  const { count, limit, threshold } = facts;
  const words = scopeWords(facts.chatbotName);
  if (threshold === 100) {
    return {
      subject: capitalize(`${words.subject} reached today's message limit`),
      usage: `${words.sentence} reached ${words.whose} daily limit of ${limit} student messages.`,
      next: "Students will see the daily-limit message until midnight US Eastern time, when the count resets.",
    };
  }
  // The real share, which can sit above the threshold when 80% of the limit
  // is not a whole number (6 of 7 is 86%).
  const percent = Math.round((count / limit) * 100);
  return {
    subject: `Heads-up: ${words.subject} used ${percent}% of today's messages`,
    usage: `${words.sentence} received ${count} of ${words.whose} ${limit} daily student messages today, ${percent}% of the limit.`,
    next: "The count resets at midnight US Eastern time.",
  };
}
