import { describe, it, expect } from "@jest/globals";
import { z } from "zod";

describe("Zod 4 ZodError migration (ZOD-02)", () => {
  const schema = z.object({
    REQUIRED_VAR: z.string().min(1),
  });

  it("ZodError has .issues array", () => {
    try {
      schema.parse({});
      throw new Error("Expected ZodError");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
      if (error instanceof z.ZodError) {
        expect(Array.isArray(error.issues)).toBe(true);
        expect(error.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it("ZodError does not have .errors property", () => {
    try {
      schema.parse({});
      throw new Error("Expected ZodError");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
      if (error instanceof z.ZodError) {
        expect((error as Record<string, unknown>).errors).toBeUndefined();
      }
    }
  });

  it("error.issues contains path information", () => {
    try {
      schema.parse({});
      throw new Error("Expected ZodError");
    } catch (error) {
      expect(error).toBeInstanceOf(z.ZodError);
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          expect(Array.isArray(issue.path)).toBe(true);
        }
      }
    }
  });
});
