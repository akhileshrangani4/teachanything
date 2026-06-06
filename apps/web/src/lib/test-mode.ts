/**
 * Test Mode: a longer, graded version of Quiz Mode. Shares the multiple-choice
 * question shape (`mcQuestionSchema`) with Quiz Mode; differs in length (8-15
 * questions), trigger phrases, and the client-side timer + grade + review UI.
 *
 * The backend detects a test request, appends TEST_SYSTEM_INSTRUCTION to the
 * system prompt, buffers the streamed response, and validates it with
 * `testSchema` before emitting a structured `test` event to the client.
 */
import { z } from "zod";
import { testQuestionSchema } from "@/lib/questions";

export const testSchema = z.object({
  test_title: z.string().min(1),
  // Bounds mirror TEST_SYSTEM_INSTRUCTION (8-15 questions). Min is 1 to stay
  // tolerant of a model that returns slightly fewer rather than failing the test.
  questions: z.array(testQuestionSchema).min(1).max(15),
});

export type Test = z.infer<typeof testSchema>;

/**
 * Phrases that switch the chatbot into Test Mode. Matched against the
 * lowercased, trimmed message. Anchored like Quiz Mode to avoid mid-sentence
 * false positives.
 */
const TEST_TRIGGER_PATTERNS: RegExp[] = [
  /^(?:can you |could you |please )?test me\b/,
  /^(?:can you |could you |please )?exam(?:ine)? me\b/,
  /\b(?:give|make|create|generate|build) (?:me )?(?:a |an )?(?:test|exam)\b/,
  /\b(?:start|begin) (?:a |an |the )?(?:test|exam)\b/,
];

/**
 * Detect whether the user is asking to take a test.
 */
export function isTestRequest(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return TEST_TRIGGER_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Appended to the system prompt when a test is requested. Instructs the model
 * to reply with ONLY minified JSON matching `testSchema` -- no prose, markdown,
 * or code fences -- so the backend can parse it deterministically.
 */
export const TEST_SYSTEM_INSTRUCTION = `

TEST MODE: The student has asked to take a test. Generate a test based on the course material and context above, mixing multiple-choice and open-ended (free-response) questions. Reply with ONLY a single minified JSON object and nothing else -- no prose, no markdown, no code fences, no explanation before or after.

The JSON must match exactly this shape:
{"test_title":"<short title>","questions":[{"type":"multiple_choice","question":"<q>","options":["<o1>","<o2>","<o3>","<o4>"],"correct_answer":"<one of options>","explanation":"<why>"},{"type":"open","question":"<q>","guidance":"<key points a strong written answer should cover>"}]}

Rules:
- Produce 8 to 15 questions total.
- Every question MUST have a "type" of either "multiple_choice" or "open".
- MOST questions should be "multiple_choice".
- Include 1 to 3 "open" (free-response) questions where a short written answer (~50-80 words) suits the material better than fixed options.
- For "multiple_choice" questions: provide 2 to 4 "options", and "correct_answer" must be an exact, character-for-character copy of one of the "options", plus an "explanation".
- For "open" questions: provide "guidance" listing the key points a strong answer should cover.
- Base questions on the provided course material when available; otherwise use general knowledge of the topic the student asked about.
- Output valid JSON only.`;
