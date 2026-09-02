import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { user } from "@teachanything/db/schema";
import type { Context } from "@/server/trpc";
import { logError } from "@/lib/logger";

// Narrowed context for helpers: only called from adminProcedure, so
// the auth middleware has already verified session. Narrowing keeps the
// helper decoupled from non-user-id fields on Context.
type AuthedContext = Context & { session: { user: { id: string } } };

/**
 * Fetch a user by id or throw NOT_FOUND if it doesn't exist.
 */
export async function requireExistingUser(
  ctx: AuthedContext,
  userId: string,
): Promise<typeof user.$inferSelect> {
  const [existingUser] = await ctx.db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!existingUser) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  return existingUser;
}

/**
 * Best-effort email send: log-and-continue so an email failure never
 * fails the mutation.
 */
export async function sendOptionalEmail(
  sendEmail: () => Promise<unknown>,
  errorMessage: string,
  errorContext: { userId: string; email: string },
): Promise<void> {
  try {
    await sendEmail();
  } catch (error) {
    logError(error, errorMessage, errorContext);
    // Don't fail the mutation if email fails
  }
}
