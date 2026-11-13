import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import { serverErrorMessage } from "@/lib/server-error-message";

const english = createI18n("en", en);
const french = createI18n("fr", fr, en);

describe("serverErrorMessage", () => {
  it("hides parser diagnostics from responses that are not our API's", () => {
    for (const message of [
      `Unexpected token 'A', "An error o"... is not valid JSON`,
      "Unexpected end of JSON input",
      "JSON.parse: unexpected character at line 1 column 1",
      "JSON Parse error: Unrecognized token '<'",
      "The string did not match the expected pattern.",
    ]) {
      expect(serverErrorMessage(french.t, { message })).toBe(
        french.t("errors.generic"),
      );
    }
  });

  it("keeps a translated client error that has no response data", () => {
    const message = french.t("files.upload.networkError");
    expect(serverErrorMessage(french.t, { message })).toBe(message);
  });

  it("translates errors that carry a catalog key", () => {
    const error = {
      message: "File not found",
      data: { i18n: { key: "errors.notFoundItems.file" } },
    };
    expect(serverErrorMessage(french.t, error)).toBe(
      french.t("errors.notFoundItems.file"),
    );
    expect(serverErrorMessage(french.t, error)).not.toBe("File not found");
  });

  it("falls back to the English message for an unknown key", () => {
    const error = {
      message: "Safe English",
      data: { i18n: { key: "errors.doesNotExist" } },
    };
    expect(serverErrorMessage(french.t, error)).toBe("Safe English");
  });

  it("hides internal errors and raw responses", () => {
    expect(
      serverErrorMessage(english.t, {
        message: "db password leaked",
        data: { code: "INTERNAL_SERVER_ERROR" },
      }),
    ).toBe(en.errors.generic);
    expect(serverErrorMessage(english.t, { message: "<html>502</html>" })).toBe(
      en.errors.generic,
    );
  });

  it("names network failures and keeps other safe messages", () => {
    expect(serverErrorMessage(english.t, { message: "Failed to fetch" })).toBe(
      en.errors.network,
    );
    expect(serverErrorMessage(english.t, { message: "Plain message" })).toBe(
      "Plain message",
    );
  });

  it("summarizes validation errors", () => {
    expect(
      serverErrorMessage(english.t, { message: "[]", data: { zodError: {} } }),
    ).toBe(en.errors.invalidInput);
  });
});
