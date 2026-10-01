import { APIError, createAuthMiddleware } from "better-auth/api";

/**
 * Reject sign-up for an email that already has an account, with the same
 * 422 / USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL error Better Auth returned before
 * we set `autoSignIn: false`.
 *
 * With auto sign-in off, Better Auth's enumeration protection answers a
 * duplicate sign-up with a fake 200, so someone who forgot they registered
 * would be sent to the pending page and wait for an approval that never comes.
 * We already told people "this email is taken" before, so restoring that
 * leaks nothing new.
 */
export const rejectDuplicateSignUp = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-up/email") return;

  const email: unknown = ctx.body?.email;
  if (typeof email !== "string") return; // Let the endpoint's own validation answer

  // Better Auth lowercases emails before storing and looking them up.
  const existing = await ctx.context.internalAdapter.findUserByEmail(
    email.toLowerCase(),
  );
  if (!existing?.user) return;

  throw new APIError("UNPROCESSABLE_ENTITY", {
    code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    message: "User already exists. Use another email.",
  });
});
