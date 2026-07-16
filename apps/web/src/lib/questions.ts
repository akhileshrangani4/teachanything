import { z } from "zod";

/**
 * The correct answer is the 0-based INDEX into `options`, not the answer string.
 *
 * A `correct_answer must be one of the options` cross-field check can only be a
 * zod refinement, and refinements are stripped from the JSON schema the model
 * receives for the `showQuiz` tool -- so the model never sees the constraint,
 * routinely emits a mismatch, and the SDK then rejects the tool input at
 * validation time (an `output-error` quiz that shows the student an error with
 * no answer). Expressing the answer as an integer index makes the constraint
 * structural: it survives into the model-facing JSON schema, and any in-range
 * (or even out-of-range) integer is a structurally valid tool call, so this
 * whole class of validation failures disappears. `QuizMessage` compares by
 * index and defensively ignores an out-of-range value.
 */
export const mcQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correct_index: z
    .number()
    .int()
    .min(0)
    .describe("0-based index into `options` of the correct choice"),
  explanation: z.string().min(1),
});

export type MCQuestion = z.infer<typeof mcQuestionSchema>;
