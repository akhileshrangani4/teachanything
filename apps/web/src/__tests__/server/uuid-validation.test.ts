import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

describe("Zod 4 UUID validation (ZOD-04/ZOD-05)", () => {
  const uuidSchema = z.string().uuid();

  it("valid RFC 4122 v4 UUID passes z.string().uuid()", () => {
    const result = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("nanoid string fails z.string().uuid()", () => {
    const result = uuidSchema.safeParse("V1StGXR8_Z5jdHi6B-myT");
    expect(result.success).toBe(false);
  });

  it("custom error message appears with { error } syntax", () => {
    const customSchema = z.string().uuid({ error: "Custom UUID error" });

    const result = customSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("Custom UUID error"))).toBe(true);
    }
  });

  it("empty string fails z.string().uuid()", () => {
    const result = uuidSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});
