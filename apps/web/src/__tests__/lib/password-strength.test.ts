import { describe, it, expect } from "@jest/globals";
import {
  validatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
  getPasswordStrengthBgColor,
} from "@/lib/password/password-strength";

describe("validatePasswordStrength", () => {
  it("returns the full result shape", () => {
    const result = validatePasswordStrength("Test1ng!");
    expect(result).toHaveProperty("isValid");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("strength");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("requirements");
    expect(typeof result.isValid).toBe("boolean");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.score).toBe("number");
    expect(Array.isArray(result.requirements)).toBe(true);
  });

  it("score is between 0 and 100", () => {
    const passwords = ["", "a", "Abc!23xK", "MyS3cur3!Pa$$w0rdExtr@Long!"];
    for (const pw of passwords) {
      const result = validatePasswordStrength(pw);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("returns isValid from underlying validatePassword", () => {
    // A password that passes all rules
    const strong = validatePasswordStrength("Str0ng!Pw@xK");
    expect(strong.isValid).toBe(true);
    expect(strong.errors).toHaveLength(0);

    // A password that fails rules
    const weak = validatePasswordStrength("abc");
    expect(weak.isValid).toBe(false);
    expect(weak.errors.length).toBeGreaterThan(0);
  });

  it("includes requirements from getPasswordRequirements", () => {
    const result = validatePasswordStrength("Test1ng!xK");
    expect(result.requirements.length).toBe(9);
    for (const req of result.requirements) {
      expect(req).toHaveProperty("id");
      expect(req).toHaveProperty("label");
      expect(req).toHaveProperty("met");
    }
  });

  describe("strength levels", () => {
    it("returns 'weak' for an empty password (score 0)", () => {
      const result = validatePasswordStrength("");
      expect(result.score).toBe(0);
      expect(result.strength).toBe("weak");
    });

    it("returns 'weak' for a low-complexity short password", () => {
      // Only lowercase, 8 chars -> length 10 + lowercase 15 = 25 (< 40)
      const result = validatePasswordStrength("abcdefgh");
      // Has sequential "abcdefgh" so -10 penalty: 10 + 15 - 10 = 15
      expect(result.strength).toBe("weak");
    });

    it("returns 'medium' for moderate passwords", () => {
      // "aB1!xyzw" - 8 chars: length 10 + lower 15 + upper 15 + number 15 + special 15 = 70
      // But has no sequential... wait, no seq. Score = 70 + number+special bonus 5 = 75 -> strong
      // Need something that lands in 40-59
      // lowercase + uppercase, 10 chars: 10 + 15 + 15 = 40 -> medium
      validatePasswordStrength("aAbBcCdDeE");
      // 10 chars: length 10, lower 15, upper 15 = 40. Has "cde" sequential: -10 -> 30 -> weak
      // Try: "aAbBxXyYzZ" - has "xyz" -> penalty. Let's use non-sequential
      // "aAbBqQwWeE" - 10 chars, no 3-letter seq pattern
      const result2 = validatePasswordStrength("aAbBqQwWeE");
      // length(10)=10 + lower=15 + upper=15 = 40 -> medium (score=40)
      expect(result2.score).toBe(40);
      expect(result2.strength).toBe("medium");
    });

    it("returns 'strong' for good passwords", () => {
      // lowercase + uppercase + number, 12 chars: 15 + 15 + 15 + 15 = 60 -> strong
      validatePasswordStrength("aAbBqQwW1234");
      // length(12)=15, lower=15, upper=15, number=15 = 60. Has "123" seq -> -10 = 50 -> medium
      // Without seq: "aAbBqQwW9876" -> has "678"? No. "987" is not in pattern. "876" not in pattern.
      // Sequential patterns: 012|123|234|345|456|567|678|789
      // "9876" has "678" reversed? The pattern checks forward only.
      // Try "aAbBqQwW4291" - no forward seq
      const result2 = validatePasswordStrength("aAbBqQwW4291");
      // length(12)=15 + lower=15 + upper=15 + number=15 = 60 -> strong
      expect(result2.score).toBe(60);
      expect(result2.strength).toBe("strong");
    });

    it("returns 'very-strong' for high-score passwords", () => {
      // 16+ chars with all types: length 20 + lower 15 + upper 15 + number 15 + special 15 = 80
      // + bonus for 16+ chars = +10 + special+number combo = +5 = 95
      const result = validatePasswordStrength("aAbBqQwWeErR!1xXyY");
      // 18 chars, has lower, upper, number, special, no repeat 3+, no seq? Check for seq
      // No 3-char forward seq in "aAbBqQwWeErR!1xXyY"
      expect(result.score).toBe(95);
      expect(result.strength).toBe("very-strong");
    });
  });

  describe("score calculation details", () => {
    it("awards 0 length points for passwords under 8 chars", () => {
      // "aA1!" = 4 chars: length 0 + lower 15 + upper 15 + number 15 + special 15 = 60
      // + special+number combo bonus = +5 = 65
      const result = validatePasswordStrength("aA1!");
      expect(result.score).toBe(65);
    });

    it("awards 10 length points for 8-11 char passwords", () => {
      // "aA1!mZpK" = 8 chars, no repeated 3+, no sequential pattern
      // length 10 + lower 15 + upper 15 + number 15 + special 15 = 70
      // + special+number combo = +5 = 75
      const result = validatePasswordStrength("aA1!mZpK");
      expect(result.score).toBe(75);
    });

    it("awards 15 length points for 12-15 char passwords", () => {
      // "aA1!mZpKqWnJ" = 12 chars, no repeated 3+, no sequential pattern
      // length 15 + lower 15 + upper 15 + number 15 + special 15 = 75
      // + special+number combo = +5 = 80
      const result = validatePasswordStrength("aA1!mZpKqWnJ");
      expect(result.score).toBe(80);
    });

    it("awards 20 length points plus 10 bonus for 16+ char passwords", () => {
      // "aA1!mZpKqWnJrLxG" = 16 chars, no repeated 3+, no sequential pattern
      // length 20 + lower 15 + upper 15 + number 15 + special 15 = 80
      // + 16+ bonus 10 + special+number combo 5 = 95
      const result = validatePasswordStrength("aA1!mZpKqWnJrLxG");
      expect(result.score).toBe(95);
    });

    it("applies -10 penalty for repeated characters (3+)", () => {
      // "aA1!mmmZpKqWnJ" = 14 chars with "mmm" (3 repeated m's)
      // length 15 + lower 15 + upper 15 + number 15 + special 15 = 75
      // -10 repeated = 65, + special+number combo 5 = 70
      const result = validatePasswordStrength("aA1!mmmZpKqWnJ");
      expect(result.score).toBe(70);
    });

    it("applies -10 penalty for sequential characters", () => {
      // "aA1!abcZpKqW" = 12 chars, has "abc" sequential, no repeated 3+
      // length 15 + lower 15 + upper 15 + number 15 + special 15 = 75
      // -10 sequential = 65, + special+number combo 5 = 70
      const result = validatePasswordStrength("aA1!abcZpKqW");
      expect(result.score).toBe(70);
    });

    it("awards +5 bonus for having both special and number", () => {
      // Compare with and without special+number combo
      // "aAbBqQwW" = 8 chars: 10 + 15 + 15 = 40 (no number, no special, no bonus)
      const withoutCombo = validatePasswordStrength("aAbBqQwW");
      expect(withoutCombo.score).toBe(40);

      // "aAbBqQw1" = 8 chars: 10 + 15 + 15 + 15 = 55 (has number but no special, no combo bonus)
      const withNumber = validatePasswordStrength("aAbBqQw1");
      expect(withNumber.score).toBe(55);

      // "aAbBqQ!1" = 8 chars: 10 + 15 + 15 + 15 + 15 = 70 + combo 5 = 75
      const withCombo = validatePasswordStrength("aAbBqQ!1");
      expect(withCombo.score).toBe(75);
    });

    it("clamps score to minimum of 0", () => {
      // An empty password scores 0, not negative
      const result = validatePasswordStrength("");
      expect(result.score).toBe(0);
    });

    it("clamps score to maximum of 100", () => {
      // Even with maximum points, score should not exceed 100
      const result = validatePasswordStrength("aAbBcCdDeEfFgGhHiI!1jJkKlLmM");
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});

describe("getPasswordStrengthColor", () => {
  it("returns red for weak", () => {
    expect(getPasswordStrengthColor("weak")).toBe("text-red-600");
  });

  it("returns yellow for medium", () => {
    expect(getPasswordStrengthColor("medium")).toBe("text-yellow-600");
  });

  it("returns blue for strong", () => {
    expect(getPasswordStrengthColor("strong")).toBe("text-blue-600");
  });

  it("returns green for very-strong", () => {
    expect(getPasswordStrengthColor("very-strong")).toBe("text-green-600");
  });
});

describe("getPasswordStrengthLabel", () => {
  it("returns 'Weak' for weak", () => {
    expect(getPasswordStrengthLabel("weak")).toBe("Weak");
  });

  it("returns 'Medium' for medium", () => {
    expect(getPasswordStrengthLabel("medium")).toBe("Medium");
  });

  it("returns 'Strong' for strong", () => {
    expect(getPasswordStrengthLabel("strong")).toBe("Strong");
  });

  it("returns 'Very Strong' for very-strong", () => {
    expect(getPasswordStrengthLabel("very-strong")).toBe("Very Strong");
  });
});

describe("getPasswordStrengthBgColor", () => {
  it("returns bg-red-500 for weak", () => {
    expect(getPasswordStrengthBgColor("weak")).toBe("bg-red-500");
  });

  it("returns bg-yellow-500 for medium", () => {
    expect(getPasswordStrengthBgColor("medium")).toBe("bg-yellow-500");
  });

  it("returns bg-blue-500 for strong", () => {
    expect(getPasswordStrengthBgColor("strong")).toBe("bg-blue-500");
  });

  it("returns bg-green-500 for very-strong", () => {
    expect(getPasswordStrengthBgColor("very-strong")).toBe("bg-green-500");
  });
});
