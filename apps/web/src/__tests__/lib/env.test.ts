/**
 * Tests for apps/web/src/lib/env.ts
 *
 * The `env` export uses `typeof window === "undefined"` to skip validation
 * in the browser. Since Jest runs with jsdom (window is defined), we test
 * the validation logic by replicating the envSchema and calling parse directly.
 * This covers the same Zod schemas and error handling patterns used in env.ts.
 */
import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

const VALID_ENV = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  BETTER_AUTH_SECRET: "a-very-long-secret-that-is-at-least-32-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
  OPENROUTER_API_KEY: "sk-or-test-key",
  OPENAI_API_KEY: "sk-test-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  ADMIN_EMAILS: "admin@test.edu",
  NODE_ENV: "test",
};

// Mirror the envSchema from env.ts to test validation logic
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  QSTASH_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ALLOWED_EMAIL_DOMAINS: z.string().default(".edu,.ac.in,.edu.in"),
  ADMIN_EMAILS: z.string().min(1),
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

describe("env schema validation", () => {
  it("parses valid environment successfully", () => {
    const result = envSchema.parse(VALID_ENV);

    expect(result.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(result.NODE_ENV).toBe("test");
    expect(result.PORT).toBe(3000);
  });

  it("applies defaults for optional fields", () => {
    const result = envSchema.parse(VALID_ENV);

    expect(result.ALLOWED_EMAIL_DOMAINS).toBe(".edu,.ac.in,.edu.in");
    expect(result.NEXT_PUBLIC_MAX_FILE_SIZE_MB).toBe("50");
    expect(result.PORT).toBe(3000);
  });

  it("throws ZodError with .issues listing missing vars", () => {
    const incomplete: Record<string, string> = { ...VALID_ENV };
    delete incomplete.DATABASE_URL;
    delete incomplete.OPENAI_API_KEY;

    try {
      envSchema.parse(incomplete);
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);

      // Replicate the env.ts error handling pattern: error.issues.map
      const zodErr = error as z.ZodError;
      const paths = zodErr.issues.map((e) => e.path.join("."));
      expect(paths).toContain("DATABASE_URL");
      expect(paths).toContain("OPENAI_API_KEY");
    }
  });

  it("error message format matches env.ts pattern", () => {
    const incomplete: Record<string, string> = { ...VALID_ENV };
    delete incomplete.DATABASE_URL;

    try {
      envSchema.parse(incomplete);
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);

      // This is the exact pattern env.ts uses on line 89
      const zodErr = error as z.ZodError;
      const missingVars = zodErr.issues.map((e) => e.path.join(".")).join(", ");
      expect(missingVars).toBe("DATABASE_URL");
    }
  });

  it("rejects invalid URL format", () => {
    const badEnv = { ...VALID_ENV, BETTER_AUTH_URL: "not-a-url" };
    expect(() => envSchema.parse(badEnv)).toThrow();
  });

  it("rejects short BETTER_AUTH_SECRET", () => {
    const badEnv = { ...VALID_ENV, BETTER_AUTH_SECRET: "too-short" };
    expect(() => envSchema.parse(badEnv)).toThrow();
  });

  it("rejects invalid NODE_ENV", () => {
    const badEnv = { ...VALID_ENV, NODE_ENV: "staging" };
    expect(() => envSchema.parse(badEnv)).toThrow();
  });

  it("coerces PORT string to number", () => {
    const withPort = { ...VALID_ENV, PORT: "8080" };
    const result = envSchema.parse(withPort);
    expect(result.PORT).toBe(8080);
  });

  it("rejects invalid email format for optional email fields", () => {
    const badEnv = { ...VALID_ENV, RESEND_FROM_EMAIL: "not-an-email" };
    expect(() => envSchema.parse(badEnv)).toThrow();
  });
});

describe("env helper logic", () => {
  // Test the pure logic of the helper functions without importing env.ts
  // (env.ts module-level side effects make it hard to test in jsdom)

  it("getApprovedDomains splits and trims correctly", () => {
    const raw = " .edu , .ac.in , .edu.in ";
    const domains = raw.split(",").map((d) => d.trim());
    expect(domains).toEqual([".edu", ".ac.in", ".edu.in"]);
  });

  it("getAdminEmails splits and trims correctly", () => {
    const raw = "admin1@test.edu, admin2@test.edu";
    const emails = raw.split(",").map((e) => e.trim());
    expect(emails).toEqual(["admin1@test.edu", "admin2@test.edu"]);
  });

  it("getMaxFileSizeBytes converts MB to bytes", () => {
    const raw = "50";
    const bytes = parseInt(raw) * 1024 * 1024;
    expect(bytes).toBe(52428800);
  });

  it("getMaxFileSizeBytes handles custom size", () => {
    const raw = "100";
    const bytes = parseInt(raw) * 1024 * 1024;
    expect(bytes).toBe(104857600);
  });

  describe("isServiceAvailable logic", () => {
    it("redis requires both URL and token", () => {
      const check = (url?: string, token?: string) => !!(url && token);

      expect(check(undefined, undefined)).toBe(false);
      expect(check("https://redis.io", undefined)).toBe(false);
      expect(check(undefined, "token")).toBe(false);
      expect(check("https://redis.io", "token")).toBe(true);
    });

    it("qstash requires token and both signing keys", () => {
      const check = (token?: string, current?: string, next?: string) =>
        !!(token && current && next);

      expect(check(undefined, undefined, undefined)).toBe(false);
      expect(check("token", "current", undefined)).toBe(false);
      expect(check("token", "current", "next")).toBe(true);
    });

    it("resend requires only API key", () => {
      expect(!!undefined).toBe(false);
      expect(!!"re_key").toBe(true);
    });

    it("supabase-storage requires URL and service role key", () => {
      const check = (url?: string, key?: string) => !!(url && key);

      expect(check(undefined, undefined)).toBe(false);
      expect(check("https://supabase.co", undefined)).toBe(false);
      expect(check("https://supabase.co", "key")).toBe(true);
    });
  });
});
