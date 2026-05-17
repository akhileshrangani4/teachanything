import { router, publicProcedure, adminProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  subscribeToNewsletter,
  listNewsletterSubscribers,
  sendNewsletterBroadcast,
} from "@/lib/email";
import { logError } from "@/lib/logger";
import { checkRateLimit, newsletterSignupRateLimit } from "@/lib/rate-limit";

export const newsletterRouter = router({
  /**
   * Public: subscribe an email address to the newsletter audience.
   */
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().trim().max(100).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const clientIp =
        ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const { success } = await checkRateLimit(
        newsletterSignupRateLimit,
        clientIp,
        { action: "newsletter-signup", email: input.email },
      );
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many signup attempts. Please try again later.",
        });
      }

      try {
        await subscribeToNewsletter({
          email: input.email,
          firstName: input.firstName,
        });
        return { success: true };
      } catch (error) {
        logError(error, "Newsletter subscription failed", {
          email: input.email,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to subscribe. Please try again.",
        });
      }
    }),

  /**
   * Admin: list all contacts in the newsletter audience.
   */
  listSubscribers: adminProcedure.query(async () => {
    try {
      return await listNewsletterSubscribers();
    } catch (error) {
      logError(error, "Failed to list newsletter subscribers");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch subscribers.",
      });
    }
  }),

  /**
   * Admin: create and send a newsletter broadcast via Resend.
   */
  sendBroadcast: adminProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(50000),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await sendNewsletterBroadcast({
          subject: input.subject,
          body: input.body,
        });
      } catch (error) {
        // sendNewsletterBroadcast already logged the Resend error details.
        // Log the caught message here so the router path is traceable too.
        logError(error, "Newsletter sendBroadcast mutation failed", {
          subjectLength: input.subject.length,
          bodyLength: input.body.length,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send newsletter. Please try again.",
        });
      }
    }),
});
