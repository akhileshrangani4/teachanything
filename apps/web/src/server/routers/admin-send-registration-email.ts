/**
 * Handler for sendRegistrationEmail mutation.
 * Extracted for testability (avoid importing entire router + tRPC + auth framework).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { db as DbType } from "@teachanything/db";
import { user, emailDeliveries } from "@teachanything/db/schema";
import { eq, sql, gte, or, and } from "drizzle-orm";
import {
  sendRequestMoreInfoEmail,
  sendIncorrectInfoEmail,
  sendGenericAdminEmail,
} from "@/lib/email";

/**
 * Zod schema for sendRegistrationEmail input validation.
 */
export const sendRegistrationEmailInputSchema = z
  .object({
    userId: z.string().min(1),
    templateId: z.enum([
      "request_more_info",
      "incorrect_info",
      "generic_admin_message",
    ]),
    customMessage: z.string().max(1000).optional(),
  })
  .refine(
    (data) =>
      data.templateId !== "generic_admin_message" ||
      !!data.customMessage?.trim(),
    {
      message: "Custom message is required for generic admin email",
      path: ["customMessage"],
    },
  );

export type SendRegistrationEmailInput = z.infer<
  typeof sendRegistrationEmailInputSchema
>;

/**
 * Handler implementation for sendRegistrationEmail mutation.
 * Tests this function directly to avoid ESM issues with tRPC/auth imports.
 */
export async function sendRegistrationEmail(
  ctx: { db: typeof DbType },
  input: SendRegistrationEmailInput,
): Promise<{ success: true }> {
  // Validate input (normally done by tRPC Zod schema, but we validate here for testability)
  const validInput = sendRegistrationEmailInputSchema.parse(input);

  // Find the user
  const [foundUser] = await ctx.db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, validInput.userId))
    .limit(1);

  if (!foundUser || !foundUser.email) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  // Check 24-hour email count
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [countResult] = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.recipientEmail, foundUser.email),
        gte(emailDeliveries.createdAt, since),
        or(
          eq(emailDeliveries.emailType, "request_more_info"),
          eq(emailDeliveries.emailType, "incorrect_info"),
          eq(emailDeliveries.emailType, "generic_admin_message"),
        ),
      ),
    );

  const sentCount = Number(countResult?.count ?? 0);
  if (sentCount >= 5) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "You can send at most 5 registration emails to this user per day.",
    });
  }

  // Dispatch to appropriate email wrapper
  const name = foundUser.name?.trim() || "User";
  switch (validInput.templateId) {
    case "request_more_info":
      await sendRequestMoreInfoEmail({
        email: foundUser.email,
        name,
      });
      break;
    case "incorrect_info":
      await sendIncorrectInfoEmail({
        email: foundUser.email,
        name,
      });
      break;
    case "generic_admin_message":
      await sendGenericAdminEmail({
        email: foundUser.email,
        name,
        customMessage: validInput.customMessage!.trim(),
      });
      break;
  }

  return { success: true };
}
