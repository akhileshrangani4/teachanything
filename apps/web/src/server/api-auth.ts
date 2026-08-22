import { auth } from "@/lib/auth";
import type { User } from "@/types/better-auth";
import { logWarn } from "@/lib/logger";

export type ApiAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: Response };

/**
 * Route Handler equivalent of tRPC's session lookup: resolves the Better Auth
 * session or produces a ready-to-return 401 Response.
 */
export async function requireApiSession(
  headers: Headers,
): Promise<ApiAuthResult> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }
  return { ok: true, user: session.user as User };
}

/**
 * Route Handler equivalent of `protectedProcedure`: requires login AND an
 * approved account (admins bypass the approval workflow). A session stays
 * valid after an admin disables an account, so this guard — not just login —
 * is what stops a rejected/pending user from consuming paid resources.
 */
export async function requireApprovedUser(
  headers: Headers,
  logContext?: Record<string, unknown>,
): Promise<ApiAuthResult> {
  const result = await requireApiSession(headers);
  if (!result.ok) return result;

  if (result.user.role !== "admin" && result.user.status !== "approved") {
    logWarn("Unapproved user attempted access", {
      userId: result.user.id,
      status: result.user.status,
      ...logContext,
    });
    return {
      ok: false,
      response: new Response("Your account is pending admin approval", {
        status: 403,
      }),
    };
  }

  return result;
}
