import { describe, it, expect } from "@jest/globals";
import {
  PASSWORD_RULES,
  COMMON_PASSWORDS,
  validatePassword,
  getPasswordRequirements,
} from "@/lib/password/password-rules";

// Helper to find a rule by id and test it
function findRule(id: string) {
  const rule = PASSWORD_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule "${id}" not found`);
  return rule;
}

describe("PASSWORD_RULES structure", () => {
  it("contains exactly 9 rules", () => {
    expect(PASSWORD_RULES).toHaveLength(9);
  });

  it("has expected rule ids", () => {
    const ids = PASSWORD_RULES.map((r) => r.id);
    expect(ids).toEqual([
      "minLength",
      "maxLength",
      "hasLowercase",
      "hasUppercase",
      "hasNumber",
      "hasSpecialChar",
      "noRepeatedChars",
      "noSequentialChars",
      "notCommon",
    ]);
  });

  it("each rule has id, label, validate, and errorMessage", () => {
    for (const rule of PASSWORD_RULES) {
      expect(typeof rule.id).toBe("string");
      expect(typeof rule.label).toBe("string");
      expect(typeof rule.validate).toBe("function");
      expect(typeof rule.errorMessage).toBe("string");
    }
  });
});

describe("COMMON_PASSWORDS", () => {
  it("is a non-empty array", () => {
    expect(COMMON_PASSWORDS.length).toBeGreaterThan(0);
  });

  it("includes well-known weak passwords", () => {
    expect(COMMON_PASSWORDS).toContain("password");
    expect(COMMON_PASSWORDS).toContain("12345678");
    expect(COMMON_PASSWORDS).toContain("admin");
  });
});

describe("individual password rules", () => {
  describe("minLength", () => {
    const rule = findRule("minLength");

    it("fails for passwords shorter than 8 characters", () => {
      expect(rule.validate("")).toBe(false);
      expect(rule.validate("1234567")).toBe(false);
    });

    it("passes for passwords with exactly 8 characters", () => {
      expect(rule.validate("12345678")).toBe(true);
    });

    it("passes for passwords longer than 8 characters", () => {
      expect(rule.validate("123456789")).toBe(true);
    });
  });

  describe("maxLength", () => {
    const rule = findRule("maxLength");

    it("passes for passwords with 128 characters or fewer", () => {
      expect(rule.validate("a".repeat(128))).toBe(true);
      expect(rule.validate("short")).toBe(true);
    });

    it("fails for passwords exceeding 128 characters", () => {
      expect(rule.validate("a".repeat(129))).toBe(false);
    });
  });

  describe("hasLowercase", () => {
    const rule = findRule("hasLowercase");

    it("passes when password contains lowercase letters", () => {
      expect(rule.validate("hello")).toBe(true);
      expect(rule.validate("HELLO world")).toBe(true);
    });

    it("fails when password has no lowercase letters", () => {
      expect(rule.validate("HELLO123!")).toBe(false);
      expect(rule.validate("12345")).toBe(false);
    });
  });

  describe("hasUppercase", () => {
    const rule = findRule("hasUppercase");

    it("passes when password contains uppercase letters", () => {
      expect(rule.validate("Hello")).toBe(true);
      expect(rule.validate("HELLO")).toBe(true);
    });

    it("fails when password has no uppercase letters", () => {
      expect(rule.validate("hello123!")).toBe(false);
      expect(rule.validate("12345")).toBe(false);
    });
  });

  describe("hasNumber", () => {
    const rule = findRule("hasNumber");

    it("passes when password contains a digit", () => {
      expect(rule.validate("abc1")).toBe(true);
      expect(rule.validate("9")).toBe(true);
    });

    it("fails when password has no digits", () => {
      expect(rule.validate("abcdef!")).toBe(false);
      expect(rule.validate("")).toBe(false);
    });
  });

  describe("hasSpecialChar", () => {
    const rule = findRule("hasSpecialChar");

    it("passes for common special characters", () => {
      expect(rule.validate("abc!")).toBe(true);
      expect(rule.validate("@")).toBe(true);
      expect(rule.validate("test#1")).toBe(true);
      expect(rule.validate("hello world")).toBe(true); // space is special
    });

    it("fails when password has only alphanumeric characters", () => {
      expect(rule.validate("abc123")).toBe(false);
      expect(rule.validate("HELLO")).toBe(false);
    });
  });

  describe("noRepeatedChars", () => {
    const rule = findRule("noRepeatedChars");

    it("passes when no character repeats 3+ times consecutively", () => {
      expect(rule.validate("aabb")).toBe(true);
      expect(rule.validate("abcabc")).toBe(true);
    });

    it("fails when a character repeats 3 or more times consecutively", () => {
      expect(rule.validate("aaa")).toBe(false);
      expect(rule.validate("passsword")).toBe(false);
      expect(rule.validate("111abc")).toBe(false);
    });

    it("allows exactly 2 consecutive repeated characters", () => {
      expect(rule.validate("aabbc")).toBe(true);
    });
  });

  describe("noSequentialChars", () => {
    const rule = findRule("noSequentialChars");

    it("passes for non-sequential characters", () => {
      expect(rule.validate("axbycz")).toBe(true);
      expect(rule.validate("hello")).toBe(true);
    });

    it("fails for alphabetical sequences", () => {
      expect(rule.validate("abcfoo")).toBe(false);
      expect(rule.validate("xyzbar")).toBe(false);
      expect(rule.validate("testdef")).toBe(false);
    });

    it("fails for numerical sequences", () => {
      expect(rule.validate("foo123")).toBe(false);
      expect(rule.validate("789bar")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(rule.validate("ABC")).toBe(false);
      expect(rule.validate("XYZ")).toBe(false);
    });

    it("passes for non-sequential strings", () => {
      expect(rule.validate("axqm!Z9")).toBe(true);
      expect(rule.validate("HjPw@42")).toBe(true);
    });
  });

  describe("notCommon", () => {
    const rule = findRule("notCommon");

    it("fails for common passwords", () => {
      expect(rule.validate("password")).toBe(false);
      expect(rule.validate("12345678")).toBe(false);
      expect(rule.validate("admin")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(rule.validate("PASSWORD")).toBe(false);
      expect(rule.validate("Password")).toBe(false);
      expect(rule.validate("ADMIN")).toBe(false);
    });

    it("passes for non-common passwords", () => {
      expect(rule.validate("xK#9mP!qL2")).toBe(true);
      expect(rule.validate("uniquepassword")).toBe(true);
    });
  });
});

describe("validatePassword", () => {
  it("returns isValid true for a strong password passing all rules", () => {
    const result = validatePassword("Str0ng!Pw@xK");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.failedRules).toHaveLength(0);
    expect(result.passedRules).toHaveLength(PASSWORD_RULES.length);
  });

  it("returns isValid false for an empty password", () => {
    const result = validatePassword("");
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.failedRules).toContain("minLength");
  });

  it("returns correct failed and passed rules for a weak password", () => {
    // "abc" fails: minLength, hasUppercase, hasNumber, hasSpecialChar, noSequentialChars
    const result = validatePassword("abc");
    expect(result.isValid).toBe(false);
    expect(result.failedRules).toContain("minLength");
    expect(result.failedRules).toContain("hasUppercase");
    expect(result.failedRules).toContain("hasNumber");
    expect(result.failedRules).toContain("hasSpecialChar");
    expect(result.failedRules).toContain("noSequentialChars");
    expect(result.passedRules).toContain("hasLowercase");
    expect(result.passedRules).toContain("maxLength");
    expect(result.passedRules).toContain("noRepeatedChars");
    expect(result.passedRules).toContain("notCommon");
  });

  it("collects error messages for each failed rule", () => {
    const result = validatePassword("abc");
    expect(result.errors.length).toBe(result.failedRules.length);
    for (const error of result.errors) {
      expect(typeof error).toBe("string");
      expect(error.length).toBeGreaterThan(0);
    }
  });

  it("detects common passwords", () => {
    const result = validatePassword("password");
    expect(result.failedRules).toContain("notCommon");
  });

  it("detects repeated characters", () => {
    const result = validatePassword("Aaaa1111!!!Bbbccc");
    expect(result.failedRules).toContain("noRepeatedChars");
  });

  it("partitions all rules into passed or failed", () => {
    const result = validatePassword("anything");
    const allRuleIds = PASSWORD_RULES.map((r) => r.id);
    const combined = [...result.passedRules, ...result.failedRules].sort();
    expect(combined).toEqual([...allRuleIds].sort());
  });
});

describe("getPasswordRequirements", () => {
  it("returns an entry for each password rule", () => {
    const requirements = getPasswordRequirements("test");
    expect(requirements).toHaveLength(PASSWORD_RULES.length);
  });

  it("each entry has id, label, and met fields", () => {
    const requirements = getPasswordRequirements("test");
    for (const req of requirements) {
      expect(req).toHaveProperty("id");
      expect(req).toHaveProperty("label");
      expect(req).toHaveProperty("met");
      expect(typeof req.met).toBe("boolean");
    }
  });

  it("marks met correctly for a strong password", () => {
    const requirements = getPasswordRequirements("Str0ng!Pw@xK");
    for (const req of requirements) {
      expect(req.met).toBe(true);
    }
  });

  it("marks minLength as not met for short passwords", () => {
    const requirements = getPasswordRequirements("Ab1!");
    const minLength = requirements.find((r) => r.id === "minLength");
    expect(minLength?.met).toBe(false);
  });

  it("preserves rule labels from PASSWORD_RULES", () => {
    const requirements = getPasswordRequirements("test");
    for (let i = 0; i < PASSWORD_RULES.length; i++) {
      expect(requirements[i]!.label).toBe(PASSWORD_RULES[i]!.label);
    }
  });
});
