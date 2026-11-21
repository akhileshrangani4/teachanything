import { describe, it, expect } from "@jest/globals";
import { formatFileSize } from "@/components/dashboard/files/file-constants";

const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

describe("formatFileSize", () => {
  it("uses the locale's decimal mark and unit", () => {
    expect(plain(formatFileSize(1.5 * 1024 ** 2, "en"))).toBe("1.5 MB");
    expect(plain(formatFileSize(1.5 * 1024 ** 2, "fr"))).toBe("1,5 Mo");
    expect(plain(formatFileSize(1.5 * 1024 ** 2, "de"))).toBe("1,5 MB");
  });

  it("formats zero without a logarithm", () => {
    expect(plain(formatFileSize(0, "en"))).toBe("0 bytes");
  });

  it("spells out bytes with the right plural", () => {
    expect(plain(formatFileSize(1, "en"))).toBe("1 byte");
    expect(plain(formatFileSize(500, "en"))).toBe("500 bytes");
    expect(plain(formatFileSize(500, "fr"))).toBe("500 octets");
  });

  it("stops at gigabytes", () => {
    expect(plain(formatFileSize(2048 * 1024 ** 3, "en"))).toBe("2,048 GB");
  });
});
