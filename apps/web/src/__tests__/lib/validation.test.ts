import { describe, it, expect } from "@jest/globals";
import {
  VALIDATION_LIMITS,
  validateName,
  validateDescription,
} from "@/lib/validation";

describe("VALIDATION_LIMITS", () => {
  it("defines expected constant values", () => {
    expect(VALIDATION_LIMITS.NAME_MAX_LENGTH).toBe(100);
    expect(VALIDATION_LIMITS.NAME_WARNING_THRESHOLD).toBe(90);
    expect(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH).toBe(200);
    expect(VALIDATION_LIMITS.DESCRIPTION_WARNING_THRESHOLD).toBe(180);
  });
});

describe("validateName", () => {
  it("returns valid for a normal name", () => {
    const result = validateName("My Chatbot");
    expect(result).toEqual({ isValid: true });
  });

  it("returns valid for a single-character name", () => {
    expect(validateName("A")).toEqual({ isValid: true });
  });

  it("returns valid for a name exactly at the max length", () => {
    const name = "a".repeat(VALIDATION_LIMITS.NAME_MAX_LENGTH);
    expect(validateName(name)).toEqual({ isValid: true });
  });

  it("returns invalid for an empty string", () => {
    const result = validateName("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name is required");
    expect(result.description).toBeDefined();
  });

  it("returns invalid for whitespace-only strings", () => {
    const result = validateName("   ");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name is required");
  });

  it("returns invalid for tabs and newlines only", () => {
    expect(validateName("\t\n")).toEqual({
      isValid: false,
      error: "Name is required",
      description: "Please provide a name for your chatbot",
    });
  });

  it("returns invalid when name exceeds max length", () => {
    const name = "a".repeat(VALIDATION_LIMITS.NAME_MAX_LENGTH + 1);
    const result = validateName(name);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name is too long");
    expect(result.description).toContain(
      String(VALIDATION_LIMITS.NAME_MAX_LENGTH),
    );
  });

  it("checks length against raw string, not trimmed", () => {
    // A name with leading spaces that is exactly at the limit after trimming
    // but exceeds max because of raw length
    const name = " ".repeat(50) + "a".repeat(51);
    expect(name.length).toBe(101);
    const result = validateName(name);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Name is too long");
  });

  it("returns valid for a name with leading/trailing spaces within limit", () => {
    const name = "  Hello  ";
    expect(validateName(name)).toEqual({ isValid: true });
  });
});

describe("validateDescription", () => {
  it("returns valid for a normal description", () => {
    expect(validateDescription("A helpful chatbot")).toEqual({ isValid: true });
  });

  it("returns valid for null when not required", () => {
    expect(validateDescription(null)).toEqual({ isValid: true });
  });

  it("returns valid for undefined when not required", () => {
    expect(validateDescription(undefined)).toEqual({ isValid: true });
  });

  it("returns valid for empty string when not required", () => {
    expect(validateDescription("")).toEqual({ isValid: true });
  });

  it("returns valid for whitespace-only when not required", () => {
    expect(validateDescription("   ")).toEqual({ isValid: true });
  });

  it("returns invalid for empty string when required", () => {
    const result = validateDescription("", true);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Description is required");
    expect(result.description).toBeDefined();
  });

  it("returns invalid for whitespace-only when required", () => {
    const result = validateDescription("   ", true);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Description is required");
  });

  it("returns invalid for null when required", () => {
    const result = validateDescription(null, true);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Description is required");
  });

  it("returns invalid for undefined when required", () => {
    const result = validateDescription(undefined, true);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Description is required");
  });

  it("returns valid for description exactly at max length", () => {
    const desc = "a".repeat(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH);
    expect(validateDescription(desc)).toEqual({ isValid: true });
  });

  it("returns invalid when description exceeds max length", () => {
    const desc = "a".repeat(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH + 1);
    const result = validateDescription(desc);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Description is too long");
    expect(result.description).toContain(
      String(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH),
    );
  });

  it("returns invalid for too-long description even when required", () => {
    const desc = "a".repeat(VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH + 1);
    const result = validateDescription(desc, true);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Description is too long");
  });

  it("defaults required to false", () => {
    // Call without the second argument - empty string should be valid
    expect(validateDescription("")).toEqual({ isValid: true });
  });
});
