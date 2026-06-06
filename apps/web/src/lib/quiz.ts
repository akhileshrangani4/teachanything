/**
 * Quiz Mode: shared types, validation, trigger detection, and the model
 * instruction used to coax a strict-JSON quiz out of the LLM.
 *
 * The backend detects a quiz request, appends QUIZ_SYSTEM_INSTRUCTION to the
 * system prompt, buffers the streamed response, and validates it with
 * `quizSchema` before emitting a structured `quiz` event to the client.
 */
import { z } from "zod";
import { mcQuestionSchema, type MCQuestion } from "@/lib/questions";

export const quizSchema = z.object({
  quiz_title: z.string().min(1),
  // Bounds mirror QUIZ_SYSTEM_INSTRUCTION (3-5 questions) so the schema and the
  // model instruction agree. Min is 1 to stay tolerant of a model that returns
  // slightly fewer rather than failing the whole quiz.
  questions: z.array(mcQuestionSchema).min(1).max(5),
});

export type QuizQuestion = MCQuestion;
export type Quiz = z.infer<typeof quizSchema>;

/**
 * Phrases that switch the chatbot into Quiz Mode. Matched against the
 * lowercased, trimmed message. Kept as a readable allowlist rather than one
 * dense regex so it's easy to extend.
 */
const QUIZ_TRIGGER_PATTERNS: RegExp[] = [
  // "quiz me", "can you quiz me", "quiz me on python" -- "quiz me" near the
  // start of the message, not buried mid-sentence ("...the quiz me page").
  /^(?:can you |could you |please )?quiz me\b/,
  // "start/begin a quiz"
  /\b(?:start|begin) (?:a |the )?quiz\b/,
  // "give me a quiz", "generate a quiz for me", "make a quiz on python"
  /\b(?:give|make|create|generate|build) (?:me )?(?:a |an )?quiz\b/,
];

/**
 * Detect whether the user is asking to be quizzed.
 */
export function isQuizRequest(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return QUIZ_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Appended to the system prompt when a quiz is requested. Instructs the model
 * to reply with ONLY minified JSON matching `quizSchema` -- no prose, markdown,
 * or code fences -- so the backend can parse it deterministically.
 */
export const QUIZ_SYSTEM_INSTRUCTION = `

QUIZ MODE: The student has asked to be quizzed. Generate a multiple-choice quiz based on the course material and context above. Reply with ONLY a single minified JSON object and nothing else -- no prose, no markdown, no code fences, no explanation before or after.

The JSON must match exactly this shape:
{"quiz_title":"<short title>","questions":[{"question":"<question text>","options":["<option1>","<option2>","<option3>","<option4>"],"correct_answer":"<must be exactly one of the options>","explanation":"<why the answer is correct>"}]}

Rules:
- Produce 3 to 5 questions.
- Each question must have 2 to 4 options.
- "correct_answer" must be an exact, character-for-character copy of one of the "options".
- Base questions on the provided course material when available; otherwise use general knowledge of the topic the student asked about.
- Output valid JSON only.`;
