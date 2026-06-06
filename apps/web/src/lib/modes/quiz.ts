import {
  isQuizRequest,
  quizSchema,
  QUIZ_SYSTEM_INSTRUCTION,
  type Quiz,
} from "@/lib/quiz";
import type { StructuredMode } from "./types";

export const quizMode: StructuredMode<Quiz> = {
  id: "quiz",
  label: "quiz",
  detect: isQuizRequest,
  canonicalTrigger: (topic) => (topic ? `quiz me on ${topic}` : "quiz me"),
  instruction: QUIZ_SYSTEM_INSTRUCTION,
  schema: quizSchema,
  summarize: (q) => `Quiz: ${q.quiz_title}`,
  fallbackMessage:
    "Sorry, I couldn't put a quiz together just now. Please try asking me to quiz you again.",
};
