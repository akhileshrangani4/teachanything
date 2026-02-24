import { describe, it, expect } from "@jest/globals";
import {
  validateDomainForAllowlist,
  SAFE_EDUCATIONAL_TLDS,
  BLOCKED_GENERIC_TLDS,
} from "@/lib/domain-validation";

describe("SAFE_EDUCATIONAL_TLDS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SAFE_EDUCATIONAL_TLDS)).toBe(true);
    expect(SAFE_EDUCATIONAL_TLDS.length).toBeGreaterThan(100);
  });

  it("contains common educational TLDs", () => {
    expect(SAFE_EDUCATIONAL_TLDS).toContain("edu");
    expect(SAFE_EDUCATIONAL_TLDS).toContain("ac.uk");
    expect(SAFE_EDUCATIONAL_TLDS).toContain("edu.in");
    expect(SAFE_EDUCATIONAL_TLDS).toContain("edu.au");
    expect(SAFE_EDUCATIONAL_TLDS).toContain("ac.jp");
  });

  it("stores TLDs in canonical form without leading dots", () => {
    for (const tld of SAFE_EDUCATIONAL_TLDS) {
      expect(tld).not.toMatch(/^\./);
    }
  });
});

describe("BLOCKED_GENERIC_TLDS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(BLOCKED_GENERIC_TLDS)).toBe(true);
    expect(BLOCKED_GENERIC_TLDS.length).toBeGreaterThan(0);
  });

  it("contains common commercial TLDs", () => {
    expect(BLOCKED_GENERIC_TLDS).toContain("com");
    expect(BLOCKED_GENERIC_TLDS).toContain("net");
    expect(BLOCKED_GENERIC_TLDS).toContain("org");
    expect(BLOCKED_GENERIC_TLDS).toContain("io");
    expect(BLOCKED_GENERIC_TLDS).toContain("ai");
    expect(BLOCKED_GENERIC_TLDS).toContain("co");
  });

  it("contains all expected blocked TLDs", () => {
    const expected = [
      "com",
      "net",
      "org",
      "biz",
      "info",
      "name",
      "pro",
      "xyz",
      "online",
      "site",
      "tech",
      "store",
      "app",
      "dev",
      "io",
      "ai",
      "co",
    ];
    expect(BLOCKED_GENERIC_TLDS).toEqual(expected);
  });
});

describe("validateDomainForAllowlist", () => {
  describe("input normalization", () => {
    it("trims whitespace", () => {
      const result = validateDomainForAllowlist("  .edu  ");
      expect(result).toEqual({ valid: true });
    });

    it("converts to lowercase", () => {
      const result = validateDomainForAllowlist(".EDU");
      expect(result).toEqual({ valid: true });
    });

    it("trims and lowercases combined", () => {
      const result = validateDomainForAllowlist("  .EDU  ");
      expect(result).toEqual({ valid: true });
    });
  });

  describe("regex validation (invalid formats)", () => {
    it("rejects empty string", () => {
      const result = validateDomainForAllowlist("");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects domains with consecutive dots", () => {
      const result = validateDomainForAllowlist("invalid..domain");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects domains with spaces", () => {
      const result = validateDomainForAllowlist("invalid domain.com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects domains with special characters", () => {
      const result = validateDomainForAllowlist("inv@lid.com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects domains ending with a dot", () => {
      const result = validateDomainForAllowlist("domain.");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects domains starting with a hyphen after the dot", () => {
      const result = validateDomainForAllowlist(".-invalid.com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects domains with underscore", () => {
      const result = validateDomainForAllowlist("under_score.com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });

    it("rejects only whitespace", () => {
      const result = validateDomainForAllowlist("   ");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("Invalid domain format");
      }
    });
  });

  describe("safe educational TLDs", () => {
    it("accepts .edu (with leading dot)", () => {
      const result = validateDomainForAllowlist(".edu");
      expect(result).toEqual({ valid: true });
    });

    it("accepts edu (without leading dot)", () => {
      const result = validateDomainForAllowlist("edu");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .ac.uk (UK academia)", () => {
      const result = validateDomainForAllowlist(".ac.uk");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .edu.in (India education)", () => {
      const result = validateDomainForAllowlist(".edu.in");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .edu.au (Australia education)", () => {
      const result = validateDomainForAllowlist(".edu.au");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .ac.jp (Japan academia)", () => {
      const result = validateDomainForAllowlist(".ac.jp");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .edu.br (Brazil education)", () => {
      const result = validateDomainForAllowlist(".edu.br");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .ac.za (South Africa academia)", () => {
      const result = validateDomainForAllowlist(".ac.za");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .edu.cn (China education)", () => {
      const result = validateDomainForAllowlist(".edu.cn");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .edu.ca (Canada education)", () => {
      const result = validateDomainForAllowlist(".edu.ca");
      expect(result).toEqual({ valid: true });
    });
  });

  describe("blocked broad TLDs", () => {
    it("rejects .com as too broad", () => {
      const result = validateDomainForAllowlist(".com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
        expect(result.reason).toContain(".com");
      }
    });

    it("rejects .net as too broad", () => {
      const result = validateDomainForAllowlist(".net");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .org as too broad", () => {
      const result = validateDomainForAllowlist(".org");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .io as too broad", () => {
      const result = validateDomainForAllowlist(".io");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .ai as too broad", () => {
      const result = validateDomainForAllowlist(".ai");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .co as too broad", () => {
      const result = validateDomainForAllowlist(".co");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .dev as too broad", () => {
      const result = validateDomainForAllowlist(".dev");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .app as too broad", () => {
      const result = validateDomainForAllowlist(".app");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .xyz as too broad", () => {
      const result = validateDomainForAllowlist(".xyz");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .biz as too broad", () => {
      const result = validateDomainForAllowlist(".biz");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects .info as too broad", () => {
      const result = validateDomainForAllowlist(".info");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("rejects blocked TLDs without leading dot", () => {
      const result = validateDomainForAllowlist("com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("too broad");
      }
    });

    it("includes suggestion for specific domain in rejection reason", () => {
      const result = validateDomainForAllowlist(".com");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("gmail.com");
        expect(result.reason).toContain("specific domains instead");
      }
    });
  });

  describe("country TLDs (non-blocked)", () => {
    it("accepts .de (Germany)", () => {
      const result = validateDomainForAllowlist(".de");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .fr (France)", () => {
      const result = validateDomainForAllowlist(".fr");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .jp (Japan)", () => {
      const result = validateDomainForAllowlist(".jp");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .br (Brazil)", () => {
      const result = validateDomainForAllowlist(".br");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .za (South Africa)", () => {
      const result = validateDomainForAllowlist(".za");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .in (India)", () => {
      const result = validateDomainForAllowlist(".in");
      expect(result).toEqual({ valid: true });
    });

    it("accepts .uk (United Kingdom)", () => {
      const result = validateDomainForAllowlist(".uk");
      expect(result).toEqual({ valid: true });
    });
  });

  describe("specific domains (always allowed)", () => {
    it("accepts gmail.com", () => {
      const result = validateDomainForAllowlist("gmail.com");
      expect(result).toEqual({ valid: true });
    });

    it("accepts vercel.ai", () => {
      const result = validateDomainForAllowlist("vercel.ai");
      expect(result).toEqual({ valid: true });
    });

    it("accepts example.org", () => {
      const result = validateDomainForAllowlist("example.org");
      expect(result).toEqual({ valid: true });
    });

    it("accepts university.edu", () => {
      const result = validateDomainForAllowlist("university.edu");
      expect(result).toEqual({ valid: true });
    });

    it("accepts my-company.io", () => {
      const result = validateDomainForAllowlist("my-company.io");
      expect(result).toEqual({ valid: true });
    });

    it("accepts subdomain.domain.com", () => {
      const result = validateDomainForAllowlist("subdomain.domain.com");
      expect(result).toEqual({ valid: true });
    });

    it("accepts domain with hyphens", () => {
      const result = validateDomainForAllowlist("my-great-domain.com");
      expect(result).toEqual({ valid: true });
    });
  });

  describe("edge cases", () => {
    it("handles domain with leading dot and mixed case", () => {
      const result = validateDomainForAllowlist(".AC.UK");
      expect(result).toEqual({ valid: true });
    });

    it("handles domain with numeric parts", () => {
      const result = validateDomainForAllowlist("123.com");
      expect(result).toEqual({ valid: true });
    });

    it("handles all blocked TLDs consistently", () => {
      for (const tld of BLOCKED_GENERIC_TLDS) {
        const result = validateDomainForAllowlist(`.${tld}`);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toContain("too broad");
        }
      }
    });

    it("handles all safe educational TLDs consistently", () => {
      for (const tld of SAFE_EDUCATIONAL_TLDS) {
        const result = validateDomainForAllowlist(`.${tld}`);
        expect(result).toEqual({ valid: true });
      }
    });
  });
});
