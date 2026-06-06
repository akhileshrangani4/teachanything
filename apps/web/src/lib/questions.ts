import { z } from "zod";

/** Shared multiple-choice question shape used by Quiz Mode and Test Mode. */
export const mcQuestionSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(4),
    correct_answer: z.string().min(1),
    explanation: z.string().min(1),
  })
  .superRefine((q, ctx) => {
    if (!q.options.includes(q.correct_answer)) {
      ctx.addIssue({
        code: "custom",
        message: "correct_answer must be one of the options",
        path: ["correct_answer"],
      });
    }
  });

export type MCQuestion = z.infer<typeof mcQuestionSchema>;

// Tagged MC variant for tests: same shape as mcQuestionSchema plus a discriminant.
// `type` defaults to "multiple_choice" so OLD persisted tests (which have no
// `type` field) still parse.
export const testMcQuestionSchema = z
  .object({
    type: z.literal("multiple_choice").default("multiple_choice"),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(4),
    correct_answer: z.string().min(1),
    explanation: z.string().min(1),
  })
  .superRefine((q, ctx) => {
    if (!q.options.includes(q.correct_answer)) {
      ctx.addIssue({
        code: "custom",
        message: "correct_answer must be one of the options",
        path: ["correct_answer"],
      });
    }
  });

export const openQuestionSchema = z.object({
  type: z.literal("open"),
  question: z.string().min(1),
  guidance: z.string().min(1), // key points a strong answer should cover
});

// A test question is either tagged-MC or open. We do NOT use
// z.discriminatedUnion here because testMcQuestionSchema is a ZodEffects
// (has superRefine) and its `type` is defaulted -- discriminatedUnion requires a
// bare literal. A plain union with the default handles untagged legacy MC:
// legacy questions (no `type`) fail the `open` branch and match the MC branch,
// where `type` defaults in. openQuestionSchema is placed FIRST so that a
// question with type:"open" matches it before the MC branch (which would
// otherwise reject the unknown `guidance`/missing MC fields anyway).
export const testQuestionSchema = z.union([
  openQuestionSchema,
  testMcQuestionSchema,
]);

export type TestMcQuestion = z.infer<typeof testMcQuestionSchema>;
export type OpenQuestion = z.infer<typeof openQuestionSchema>;
export type TestQuestion = z.infer<typeof testQuestionSchema>;
