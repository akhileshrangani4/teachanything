import { z } from "zod";

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
