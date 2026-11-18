import { adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { emailDeliveries } from "@teachanything/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { adminActionRateLimit, checkRateLimit } from "@/server/rate-limit";
import {
  sendRequestMoreInfoEmail,
  sendIncorrectInfoEmail,
  sendGenericAdminEmail,
} from "@/server/email";
import { MAX_CUSTOM_MESSAGE_LENGTH } from "@/lib/registration-email-templates";
import { requireExistingUser } from "../helpers";

// Better Auth uses nanoid ids, not UUIDs.
const userId = z.string().min(1);

/**
 * Discriminated on templateId: only the custom message template takes (and
 * requires) customMessage. `.strict()` rejects a customMessage sent with the
 * other two, which would otherwise be silently dropped.
 */
export const sendRegistrationEmailInputSchema = z.discriminatedUnion(
  "templateId",
  [
    z.object({ userId, templateId: z.literal("request_more_info") }).strict(),
    z.object({ userId, templateId: z.literal("incorrect_info") }).strict(),
    z
      .object({
        userId,
        templateId: z.literal("generic_admin_message"),
        customMessage: z.string().trim().min(1).max(MAX_CUSTOM_MESSAGE_LENGTH),
      })
      .strict(),
  ],
);

/** Courtesy cap so one pending user is not flooded with registration emails. */
export const MAX_REGISTRATION_EMAILS_PER_USER_PER_DAY = 5;

// Sends that reached, or are on their way to, the recipient. A failed QStash
// publish writes a `failed` row and must not use up the user's allowance.
const COUNTED_DELIVERY_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "delayed",
] as const;

const REGISTRATION_EMAIL_TYPES = [
  "request_more_info",
  "incorrect_info",
  "generic_admin_message",
] as const;

/**
 * Send a templated registration email to a pending user.
 *
 * The procedure, not the UI, is the boundary: only pending users can be
 * messaged, so the free-text template cannot be pointed at arbitrary accounts.
 */
export const sendRegistrationEmailProcedure = adminProcedure
  .input(sendRegistrationEmailInputSchema)
  .mutation(async ({ ctx, input }) => {
    const adminId = ctx.session.user.id;

    const { success } = await checkRateLimit(adminActionRateLimit, adminId, {
      adminId,
      endpoint: "sendRegistrationEmail",
    });
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many admin actions. Please wait a minute and try again.",
      });
    }

    const recipient = await requireExistingUser(ctx, input.userId);
    if (recipient.status !== "pending") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Registration emails can only be sent to pending users.",
      });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [countResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailDeliveries)
      .where(
        and(
          eq(emailDeliveries.recipientEmail, recipient.email),
          gte(emailDeliveries.createdAt, since),
          inArray(emailDeliveries.emailType, [...REGISTRATION_EMAIL_TYPES]),
          inArray(emailDeliveries.deliveryStatus, [
            ...COUNTED_DELIVERY_STATUSES,
          ]),
        ),
      );
    if (
      Number(countResult?.count ?? 0) >=
      MAX_REGISTRATION_EMAILS_PER_USER_PER_DAY
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `This user has already been sent ${MAX_REGISTRATION_EMAILS_PER_USER_PER_DAY} registration emails in the last 24 hours.`,
      });
    }

    const recipientParams = {
      email: recipient.email,
      name: recipient.name?.trim() || "User",
      sentByAdminId: adminId,
    };
    switch (input.templateId) {
      case "request_more_info":
        await sendRequestMoreInfoEmail(recipientParams);
        break;
      case "incorrect_info":
        await sendIncorrectInfoEmail(recipientParams);
        break;
      case "generic_admin_message":
        await sendGenericAdminEmail({
          ...recipientParams,
          customMessage: input.customMessage,
        });
        break;
    }

    return { success: true };
  });
