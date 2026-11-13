import { describe, it, expect } from "@jest/globals";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { createI18n } from "@/i18n/create-i18n";
import {
  fileAssociationErrorMessage,
  isFailedFileError,
  storedFileErrorMessage,
} from "@/lib/stored-file-error";
import {
  sanitizeProcessingError,
  STORAGE_MISSING_ERROR,
} from "@/lib/processing-error";
import {
  STALE_PENDING_ERROR,
  STALE_PROCESSING_ERROR,
} from "@/server/file-stale";

const french = createI18n("fr", fr, en);

describe("storedFileErrorMessage", () => {
  it("translates with only the fallback a localized page receives", () => {
    const page = createI18n("fr", fr, { files: { errors: en.files.errors } });
    expect(
      storedFileErrorMessage(page, en.files.errors.passwordProtected),
    ).toBe(fr.files.errors.passwordProtected);
  });

  // If the pipeline's English drifts from the catalog, these stop translating.
  it.each([
    ["something timed out", "timedOut"],
    ["no readable text in file", "noReadableText"],
    ["bytes do not match the file type", "formatMismatch"],
    ["Empty file", "emptyFile"],
    ["Invalid PDF", "invalidPdf"],
    ["file is encrypted", "passwordProtected"],
    ["embedding dimension mismatch", "embeddingDimension"],
    ["Failed to extract PDF content", "pdfUnreadable"],
    ["Failed to extract Word document content", "wordUnreadable"],
    ["Failed to extract content", "unreadable"],
    ["insufficient_quota", "providerQuota"],
    ["503", "providerUnavailable"],
    ["anything else", "internal"],
  ] as const)("translates the pipeline's sentence for %s", (raw, key) => {
    const stored = sanitizeProcessingError(new Error(raw));
    expect(stored).toBe(en.files.errors[key]);
    expect(storedFileErrorMessage(french, stored)).toBe(fr.files.errors[key]);
  });

  it.each([
    [STORAGE_MISSING_ERROR, "storageMissing"],
    [STALE_PENDING_ERROR, "stalePending"],
    [STALE_PROCESSING_ERROR, "staleProcessing"],
  ] as const)("translates the stored constant %s", (stored, key) => {
    expect(stored).toBe(en.files.errors[key]);
    expect(storedFileErrorMessage(french, stored)).toBe(fr.files.errors[key]);
  });

  it("translates an unsupported type with its value", () => {
    expect(
      storedFileErrorMessage(french, "Unsupported file type: image/png"),
    ).toBe(french.t("files.errors.unsupportedType", { type: "image/png" }));
  });

  it("translates an unsupported type behind the extraction wrapper", () => {
    const stored = sanitizeProcessingError(
      new Error("Failed to extract content: Unsupported file type: image/png"),
    );
    expect(storedFileErrorMessage(french, stored)).toBe(
      french.t("files.errors.unsupportedType", { type: "image/png" }),
    );
  });

  it("keeps unknown stored text", () => {
    expect(storedFileErrorMessage(french, "Odd old error")).toBe(
      "Odd old error",
    );
  });
});

describe("fileAssociationErrorMessage", () => {
  const key = "errors.files.failedToProcessWithReason";

  it("translates the stored reason inside the sentence", () => {
    expect(
      fileAssociationErrorMessage(french, {
        message: "English sentence",
        data: {
          i18n: { key, values: { error: en.files.errors.emptyFile } },
        },
      }),
    ).toBe(french.t(key, { error: fr.files.errors.emptyFile }));
  });

  it("treats other errors like any server error", () => {
    expect(
      fileAssociationErrorMessage(french, {
        message: "Plain message",
        data: { code: "BAD_REQUEST" },
      }),
    ).toBe("Plain message");
  });
});

describe("isFailedFileError", () => {
  it.each([
    "errors.files.failedToProcess",
    "errors.files.failedToProcessWithReason",
  ])("recognizes %s whatever the message says", (key) => {
    expect(
      isFailedFileError({ message: "Autre texte", data: { i18n: { key } } }),
    ).toBe(true);
  });

  it("ignores other errors, even ones that mention a failure", () => {
    expect(
      isFailedFileError({
        message: "This file failed to process",
        data: { i18n: { key: "errors.notFoundItems.file" } },
      }),
    ).toBe(false);
    expect(isFailedFileError({ message: "failed to process" })).toBe(false);
  });
});
