import { describe, it, expect } from "@jest/globals";
import { parseAcceptLanguage, resolveLocale } from "@/i18n/resolve-locale";
import type { Locale } from "@/i18n/config";

const ALL: Locale[] = ["en", "fr", "es", "de"];

describe("parseAcceptLanguage", () => {
  it("reads q case-insensitively and drops an empty q", () => {
    expect(parseAcceptLanguage("fr;Q=0, de;Q=0.5")).toEqual(["de"]);
    expect(parseAcceptLanguage("fr;q=, de")).toEqual(["de"]);
  });

  it("orders by quality and keeps header order on ties", () => {
    expect(parseAcceptLanguage("fr;q=0.2, de;q=0.9, es")).toEqual([
      "es",
      "de",
      "fr",
    ]);
    expect(parseAcceptLanguage("de, fr")).toEqual(["de", "fr"]);
  });

  it("drops q=0, malformed weights and empty input", () => {
    expect(parseAcceptLanguage("fr;q=0, de;q=abc, es;q=2, en")).toEqual(["en"]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe("resolveLocale", () => {
  it("prefers the saved choice, then the cookie, then the browser", () => {
    expect(
      resolveLocale({
        saved: "fr",
        cookie: "de",
        acceptLanguage: "es",
        enabled: ALL,
      }),
    ).toBe("fr");
    expect(
      resolveLocale({
        saved: null,
        cookie: "de",
        acceptLanguage: "es",
        enabled: ALL,
      }),
    ).toBe("de");
    expect(
      resolveLocale({
        cookie: "xx",
        acceptLanguage: "es-MX,en;q=0.5",
        enabled: ALL,
      }),
    ).toBe("es");
  });

  it("matches regional tags case-insensitively", () => {
    expect(resolveLocale({ acceptLanguage: "FR-ca", enabled: ALL })).toBe("fr");
  });

  it("falls back to English when nothing enabled matches", () => {
    expect(resolveLocale({ acceptLanguage: "ja, zh", enabled: ALL })).toBe(
      "en",
    );
    expect(resolveLocale({ acceptLanguage: "fr;q=0", enabled: ALL })).toBe(
      "en",
    );
  });

  it("lets a wildcard pick the first locale the header did not exclude", () => {
    expect(resolveLocale({ acceptLanguage: "*", enabled: ALL })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "ja, *;q=0.5", enabled: ALL })).toBe(
      "en",
    );
    expect(resolveLocale({ acceptLanguage: "en;q=0, *", enabled: ALL })).toBe(
      "fr",
    );
  });

  it("ignores disabled locales from every source", () => {
    expect(
      resolveLocale({
        saved: "fr",
        cookie: "fr",
        acceptLanguage: "fr",
        enabled: ["en"],
      }),
    ).toBe("en");
  });
});
