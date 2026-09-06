import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@teachanything/db";
import * as schema from "@teachanything/db/schema";
import { env } from "@/lib/env";
import { sendPasswordResetEmail } from "../email";
import { passwordResetRateLimit, checkRateLimit } from "../rate-limit";
import * as bcrypt from "bcryptjs";
import { enforceAllowedDomain } from "./domain-check";
import { registerPendingUserAndNotify } from "./registration";
import { gateSessionCreation } from "./session-gate";

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
          await enforceAllowedDomain(user);
        },
        after: async (user) => {
          await registerPendingUserAndNotify(user);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          return await gateSessionCreation(session);
        },
      },
    },
  },
});
