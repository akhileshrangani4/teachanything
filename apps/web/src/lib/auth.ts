import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { env, getApprovedDomains } from "./env";
import { logInfo, logError } from "./logger";
import {
  sendAdminNotificationEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPasswordResetEmail,
} from "./email";
import { passwordResetRateLimit, checkRateLimit } from "./rate-limit";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // We're using approval instead
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, 12);
      },
      verify: async ({
        hash,
        password,
      }: {
        hash: string;
        password: string;
      }) => {
        return await bcrypt.compare(password, hash);
      },
    },
    /**
     * Sends a password reset email to the user.
     *
     * Security note: The email send is intentionally not awaited to prevent
     * timing attacks. If we awaited, an attacker could measure response times
     * to determine whether an email address exists in our system (valid emails
     * would take longer due to the email send). By returning immediately
     * regardless of email validity, response times remain consistent.
     *
     * Rate limiting is checked but failures are not surfaced to the caller
     * to maintain consistent timing regardless of rate limit state.
     */
    sendResetPassword: async ({ user, url }) => {
      // Rate limit by email address to prevent email bombing
      const { success } = await checkRateLimit(
        passwordResetRateLimit,
        user.email,
        { email: user.email, endpoint: "sendResetPassword" },
      );

      if (!success) {
        // Don't send but also don't reveal rate limiting to prevent enumeration
        return;
      }

      void sendPasswordResetEmail({
        email: user.email,
        name: user.name || "User",
        resetUrl: url,
      });
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
  // Custom error messages
  advanced: {
    generateId: undefined,
    useSecureCookies: env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
  },
  user: {
    // Include custom fields in session
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "user",
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "pending",
      },
      // Verification fields (optional in auth config, required at registration via client-side validation)
      title: {
        type: "string",
        required: false,
      },
      institutionalAffiliation: {
        type: "string",
        required: false, // Nullable in DB for existing users; enforced at registration
      },
      department: {
        type: "string",
        required: false, // Nullable in DB for existing users; enforced at registration
      },
      facultyWebpage: {
        type: "string",
        required: false,
      },
      country: {
        type: "string",
        required: false,
      },
    },
  },

  // Database hooks for approval workflow
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Check if email domain is in allowed list
          const emailDomain = user.email.substring(user.email.lastIndexOf("@"));
          const allowedDomains = getApprovedDomains();

          // Also check database for allowed domains
          const dbDomains = await db.select().from(schema.approvedDomains);
          const allAllowedDomains = [
            ...allowedDomains,
            ...dbDomains.map((d) => d.domain),
          ];

          const isAllowedDomain = allAllowedDomains.some((domain) =>
            emailDomain.endsWith(domain),
          );

          // If domain not allowed and list is not empty, reject registration
          if (allAllowedDomains.length > 0 && !isAllowedDomain) {
            logError(
              new Error("Unauthorized domain"),
              "Registration blocked for unauthorized domain",
              {
                email: user.email,
                domain: emailDomain,
              },
            );
            // Use Better Auth's APIError for proper error messaging
            throw new APIError("BAD_REQUEST", {
              message:
                "This email domain is not authorized for registration. Please contact an administrator if you believe this is an error.",
            });
          }

          logInfo("Domain check passed for new user", {
            email: user.email,
          });
        },
        after: async (user) => {
          try {
            logInfo("New user created", {
              userId: user.id,
              email: user.email,
            });

            // Set user status to pending
            await db
              .update(schema.user)
              .set({ status: "pending" })
              .where(eq(schema.user.id, user.id));

            // Send notification to admins - this is critical, so we fail if it doesn't work
            await sendAdminNotificationEmail({
              userId: user.id,
              email: user.email,
              name: user.name || "Unknown",
            });

            logInfo("User set to pending and admin notified", {
              userId: user.id,
              email: user.email,
            });
          } catch (error) {
            // If email notification fails, delete the user and fail the registration
            logError(
              error,
              "Failed to send admin notification, rolling back user creation",
              {
                userId: user.id,
                email: user.email,
              },
            );

            try {
              await db.delete(schema.user).where(eq(schema.user.id, user.id));

              logInfo("User deleted due to notification failure", {
                userId: user.id,
                email: user.email,
              });
            } catch (deleteError) {
              logError(
                deleteError,
                "Failed to delete user after notification failure",
                {
                  userId: user.id,
                },
              );
            }

            // Re-throw error to fail the registration
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message:
                "Unable to complete registration. Please try again later or contact support.",
            });
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          try {
            // Check if user is approved before creating session
            const [user] = await db
              .select()
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .limit(1);

            if (!user) {
              logError(
                new Error("User not found"),
                "Session creation for non-existent user",
                {
                  userId: session.userId,
                },
              );
              return false; // Abort session creation
            }

            // Admins bypass the approval workflow
            if (user.role === "admin") {
              logInfo("Session creation approved for admin", {
                userId: user.id,
                email: user.email,
                role: user.role,
              });
              return true; // Allow session creation for admins
            }

            // For non-admin users, check status
            if (user.status === "pending") {
              logInfo("Session creation blocked for pending user", {
                userId: user.id,
                email: user.email,
              });
              throw new APIError("UNAUTHORIZED", {
                message: "ACCOUNT_PENDING",
              });
            }

            if (user.status === "rejected") {
              logInfo("Session creation blocked for rejected user", {
                userId: user.id,
                email: user.email,
              });
              throw new APIError("UNAUTHORIZED", {
                message: "ACCOUNT_REJECTED",
              });
            }

            logInfo("Session creation approved", {
              userId: user.id,
              email: user.email,
              role: user.role,
            });

            return true; // Allow session creation
          } catch (error) {
            logError(error, "Error in session.create.before hook", {
              userId: session.userId,
            });
            return false; // Abort session creation on error
          }
        },
      },
    },
  },
});

// Helper to check if user is approved
export async function isUserApproved(userId: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  return user?.status === "approved";
}

// Helper to check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  return user?.role === "admin";
}

// Helper to approve user
export async function approveUser(userId: string): Promise<void> {
  const [user] = await db
    .update(schema.user)
    .set({ status: "approved" })
    .where(eq(schema.user.id, userId))
    .returning();

  if (user) {
    logInfo("User approved", {
      userId: user.id,
      email: user.email,
    });

    // Send approval email
    try {
      await sendApprovalEmail({
        email: user.email,
        name: user.name || "User",
      });
    } catch (error) {
      logError(error, "Failed to send approval email", {
        userId: user.id,
      });
    }
  }
}

// Helper to reject user
export async function rejectUser(userId: string): Promise<void> {
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (user) {
    // Update status to rejected
    await db
      .update(schema.user)
      .set({ status: "rejected" })
      .where(eq(schema.user.id, userId));

    logInfo("User rejected", {
      userId: user.id,
      email: user.email,
    });

    // Send rejection email
    try {
      await sendRejectionEmail({
        email: user.email,
        name: user.name || "User",
      });
    } catch (error) {
      logError(error, "Failed to send rejection email", {
        userId: user.id,
      });
    }
  }
}
