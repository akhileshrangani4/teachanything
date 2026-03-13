import { z } from "zod";

// Skip validation for CI builds with dummy values
const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  // Supabase (optional — file uploads disabled without these)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  // OpenRouter
  OPENROUTER_API_KEY: z.string().min(1),

  // OpenAI (for embeddings - OpenRouter doesn't support embeddings)
  OPENAI_API_KEY: z.string().min(1),

  // Resend (optional — emails logged to console without these)
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Upstash Redis (optional — rate limiting disabled without these)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Upstash QStash (optional — async jobs run inline without these)
  QSTASH_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),

  // App Config
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ALLOWED_EMAIL_DOMAINS: z.string().default(".edu,.ac.in,.edu.in"),
  ADMIN_EMAILS: z.string().min(1), // Comma-separated list of admin emails
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.string().default("50"),
  NEXT_PUBLIC_GITHUB_URL: z.string().url().optional(),
  NEXT_PUBLIC_DONATION_URL: z.string().url().optional(),
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_LINKEDIN_URL: z.string().url().optional(),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // Skip validation in CI builds - return a proxy that provides dummy values on-demand
  if (skipValidation) {
    console.warn("⚠️  Skipping environment validation (CI mode)");
    // Return a proxy that provides sensible dummy values for any accessed property
    return new Proxy({} as Env, {
      get(_target, prop: string) {
        // Return dummy values based on property name patterns
        if (prop === "PORT") return 3000;
        if (prop === "NODE_ENV") return "production";
        if (prop === "ALLOWED_EMAIL_DOMAINS") return ".edu,.ac.in,.edu.in";
        if (prop === "NEXT_PUBLIC_MAX_FILE_SIZE_MB") return "50";
        if (prop.includes("URL")) return "http://localhost:3000";
        if (prop.includes("EMAIL")) return "ci@localhost";
        if (
          prop.includes("SECRET") ||
          prop.includes("KEY") ||
          prop.includes("TOKEN")
        ) {
          return "ci-dummy-secret-key-min-32-chars-long";
        }
        return "ci-dummy-value";
      },
    });
  }

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((e) => e.path.join(".")).join(", ");
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}`,
      );
    }
    throw error;
  }
}

// Validate env on module load (server-side only)
export const env = typeof window === "undefined" ? validateEnv() : ({} as Env);

/**
 * Check whether an optional external service is configured.
 * Use this to gate features that depend on third-party APIs.
 */
export function isServiceAvailable(
  service: "redis" | "qstash" | "resend" | "supabase-storage",
): boolean {
  switch (service) {
    case "redis":
      return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
    case "qstash":
      return !!(
        env.QSTASH_TOKEN &&
        env.QSTASH_CURRENT_SIGNING_KEY &&
        env.QSTASH_NEXT_SIGNING_KEY
      );
    case "resend":
      return !!env.RESEND_API_KEY;
    case "supabase-storage":
      return !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  }
}

// Helper to get approved email domains as array
export function getApprovedDomains(): string[] {
  return env.ALLOWED_EMAIL_DOMAINS.split(",").map((d) => d.trim());
}

// Helper to get admin emails as array
export function getAdminEmails(): string[] {
  return env.ADMIN_EMAILS.split(",").map((e) => e.trim());
}

// Helper to get max file size in bytes
export function getMaxFileSizeBytes(): number {
  return parseInt(env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) * 1024 * 1024;
}
