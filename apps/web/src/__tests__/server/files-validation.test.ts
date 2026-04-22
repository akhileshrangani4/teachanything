import { jest, describe, it, expect } from "@jest/globals";
import { TRPCError } from "@trpc/server";

jest.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_MAX_FILE_SIZE_MB: "50" },
}));

const {
  validateFileName,
  validateFileSize,
  validateFileType,
  validateExtensionMatchesMimeType,
  SUPPORTED_FILE_TYPES,
  EXTENSION_MIME_MAP,
  FILE_TYPE_DISPLAY_NAMES,
} = await import("@/server/routers/files/validation");

/** Helper: asserts a TRPCError is thrown with the expected code and optional message substring */
function expectTRPCError(
  fn: () => void,
  code: string,
  messageSubstring?: string,
) {
  try {
    fn();
    // If we reach here, the function did not throw
    throw new Error("Expected function to throw a TRPCError");
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    const trpcError = error as TRPCError;
    expect(trpcError.code).toBe(code);
    if (messageSubstring) {
      expect(trpcError.message).toContain(messageSubstring);
    }
  }
}

describe("SUPPORTED_FILE_TYPES", () => {
  it("includes all expected MIME types", () => {
    expect(SUPPORTED_FILE_TYPES).toContain("application/pdf");
    expect(SUPPORTED_FILE_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(SUPPORTED_FILE_TYPES).toContain("application/msword");
    expect(SUPPORTED_FILE_TYPES).toContain(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(SUPPORTED_FILE_TYPES).toContain("text/plain");
    expect(SUPPORTED_FILE_TYPES).toContain("text/markdown");
    expect(SUPPORTED_FILE_TYPES).toContain("application/json");
    expect(SUPPORTED_FILE_TYPES).toContain("text/csv");
  });

  it("has exactly 8 supported types", () => {
    expect(SUPPORTED_FILE_TYPES).toHaveLength(8);
  });
});

describe("EXTENSION_MIME_MAP", () => {
  it("maps pdf to application/pdf", () => {
    expect(EXTENSION_MIME_MAP["pdf"]).toEqual(["application/pdf"]);
  });

  it("maps doc to application/msword", () => {
    expect(EXTENSION_MIME_MAP["doc"]).toEqual(["application/msword"]);
  });

  it("maps docx to the openxml MIME type", () => {
    expect(EXTENSION_MIME_MAP["docx"]).toEqual([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
  });

  it("maps txt to text/plain", () => {
    expect(EXTENSION_MIME_MAP["txt"]).toEqual(["text/plain"]);
  });

  it("maps md and markdown to text/markdown", () => {
    expect(EXTENSION_MIME_MAP["md"]).toEqual(["text/markdown"]);
    expect(EXTENSION_MIME_MAP["markdown"]).toEqual(["text/markdown"]);
  });

  it("maps json to application/json", () => {
    expect(EXTENSION_MIME_MAP["json"]).toEqual(["application/json"]);
  });

  it("maps csv to text/csv", () => {
    expect(EXTENSION_MIME_MAP["csv"]).toEqual(["text/csv"]);
  });
});

describe("FILE_TYPE_DISPLAY_NAMES", () => {
  it("has display names for all supported types", () => {
    expect(FILE_TYPE_DISPLAY_NAMES["application/pdf"]).toBe("PDF");
    expect(
      FILE_TYPE_DISPLAY_NAMES[
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
    ).toBe("Word (.docx)");
    expect(FILE_TYPE_DISPLAY_NAMES["application/msword"]).toBe("Word (.doc)");
    expect(FILE_TYPE_DISPLAY_NAMES["text/plain"]).toBe("Text");
    expect(FILE_TYPE_DISPLAY_NAMES["text/markdown"]).toBe("Markdown");
    expect(FILE_TYPE_DISPLAY_NAMES["application/json"]).toBe("JSON");
    expect(FILE_TYPE_DISPLAY_NAMES["text/csv"]).toBe("CSV");
  });
});

describe("validateFileName", () => {
  describe("valid file names", () => {
    it("accepts a simple file name", () => {
      expect(() => validateFileName("document.pdf")).not.toThrow();
    });

    it("accepts file names with spaces", () => {
      expect(() => validateFileName("my document.pdf")).not.toThrow();
    });

    it("accepts file names with hyphens and dots", () => {
      expect(() => validateFileName("my-file.name.txt")).not.toThrow();
    });

    it("accepts file names with numbers", () => {
      expect(() => validateFileName("file123.doc")).not.toThrow();
    });

    it("accepts file name with parentheses", () => {
      expect(() => validateFileName("report (1).pdf")).not.toThrow();
    });

    it("accepts file name at exactly 255 characters", () => {
      const name = "a".repeat(251) + ".pdf";
      expect(name.length).toBe(255);
      expect(() => validateFileName(name)).not.toThrow();
    });
  });

  describe("invalid characters", () => {
    it("rejects file name with less-than sign", () => {
      expectTRPCError(
        () => validateFileName("file<name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with greater-than sign", () => {
      expectTRPCError(
        () => validateFileName("file>name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with colon", () => {
      expectTRPCError(
        () => validateFileName("file:name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with double quote", () => {
      expectTRPCError(
        () => validateFileName('file"name.pdf'),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with forward slash", () => {
      expectTRPCError(
        () => validateFileName("file/name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with backslash", () => {
      expectTRPCError(
        () => validateFileName("file\\name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with pipe", () => {
      expectTRPCError(
        () => validateFileName("file|name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with question mark", () => {
      expectTRPCError(
        () => validateFileName("file?name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with asterisk", () => {
      expectTRPCError(
        () => validateFileName("file*name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });
  });

  describe("control characters", () => {
    it("rejects file name with null byte (charCode 0)", () => {
      expectTRPCError(
        () => validateFileName("file\x00name.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with tab (charCode 9)", () => {
      expectTRPCError(
        () => validateFileName("file\tname.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with newline (charCode 10)", () => {
      expectTRPCError(
        () => validateFileName("file\nname.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with carriage return (charCode 13)", () => {
      expectTRPCError(
        () => validateFileName("file\rname.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with escape character (charCode 27)", () => {
      expectTRPCError(
        () => validateFileName("file\x1Bname.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });

    it("rejects file name with unit separator (charCode 31)", () => {
      expectTRPCError(
        () => validateFileName("file\x1Fname.pdf"),
        "BAD_REQUEST",
        "invalid characters",
      );
    });
  });

  describe("file name length", () => {
    it("rejects file name longer than 255 characters", () => {
      const longName = "a".repeat(256);
      expectTRPCError(
        () => validateFileName(longName),
        "BAD_REQUEST",
        "less than 255 characters",
      );
    });

    it("rejects extremely long file name", () => {
      const longName = "a".repeat(1000) + ".pdf";
      expectTRPCError(
        () => validateFileName(longName),
        "BAD_REQUEST",
        "less than 255 characters",
      );
    });
  });
});

describe("validateFileSize", () => {
  describe("valid file sizes", () => {
    it("accepts a small file (1 byte)", () => {
      expect(() => validateFileSize(1)).not.toThrow();
    });

    it("accepts a normal-sized file (5MB)", () => {
      expect(() => validateFileSize(5 * 1024 * 1024)).not.toThrow();
    });

    it("accepts a file at exactly the max size", () => {
      const maxBytes = 50 * 1024 * 1024;
      expect(() => validateFileSize(maxBytes)).not.toThrow();
    });

    it("accepts a file just under the max size", () => {
      const maxBytes = 50 * 1024 * 1024 - 1;
      expect(() => validateFileSize(maxBytes)).not.toThrow();
    });
  });

  describe("invalid file sizes", () => {
    it("rejects zero-byte file", () => {
      expectTRPCError(
        () => validateFileSize(0),
        "BAD_REQUEST",
        "Cannot upload empty file",
      );
    });

    it("rejects file exceeding max size", () => {
      const overMax = 50 * 1024 * 1024 + 1;
      expectTRPCError(
        () => validateFileSize(overMax),
        "BAD_REQUEST",
        "exceeds",
      );
    });

    it("rejects very large file", () => {
      const veryLarge = 200 * 1024 * 1024;
      expectTRPCError(
        () => validateFileSize(veryLarge),
        "BAD_REQUEST",
        "50MB limit",
      );
    });

    it("includes current file size in error message", () => {
      const fileSize = 60 * 1024 * 1024; // 60MB
      try {
        validateFileSize(fileSize);
        throw new Error("Expected to throw");
      } catch (error) {
        const trpcError = error as TRPCError;
        expect(trpcError.message).toContain("60.00MB");
      }
    });
  });
});

describe("validateFileType", () => {
  describe("supported types", () => {
    it("accepts application/pdf", () => {
      expect(() => validateFileType("application/pdf")).not.toThrow();
    });

    it("accepts docx MIME type", () => {
      expect(() =>
        validateFileType(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).not.toThrow();
    });

    it("accepts application/msword", () => {
      expect(() => validateFileType("application/msword")).not.toThrow();
    });

    it("accepts text/plain", () => {
      expect(() => validateFileType("text/plain")).not.toThrow();
    });

    it("accepts text/markdown", () => {
      expect(() => validateFileType("text/markdown")).not.toThrow();
    });

    it("accepts application/json", () => {
      expect(() => validateFileType("application/json")).not.toThrow();
    });

    it("accepts text/csv", () => {
      expect(() => validateFileType("text/csv")).not.toThrow();
    });
  });

  describe("unsupported types", () => {
    it("rejects image/png", () => {
      expectTRPCError(
        () => validateFileType("image/png"),
        "BAD_REQUEST",
        "Unsupported file type",
      );
    });

    it("rejects application/zip", () => {
      expectTRPCError(
        () => validateFileType("application/zip"),
        "BAD_REQUEST",
        "Unsupported file type",
      );
    });

    it("rejects text/html", () => {
      expectTRPCError(
        () => validateFileType("text/html"),
        "BAD_REQUEST",
        "Unsupported file type",
      );
    });

    it("rejects empty string", () => {
      expectTRPCError(
        () => validateFileType(""),
        "BAD_REQUEST",
        "Unsupported file type",
      );
    });

    it("rejects arbitrary string", () => {
      expectTRPCError(
        () => validateFileType("not-a-mime-type"),
        "BAD_REQUEST",
        "Unsupported file type",
      );
    });

    it("includes display name for known unsupported types in error", () => {
      try {
        validateFileType("image/png");
        throw new Error("Expected to throw");
      } catch (error) {
        const trpcError = error as TRPCError;
        // image/png is not in FILE_TYPE_DISPLAY_NAMES, so the raw type is used
        expect(trpcError.message).toContain("image/png");
      }
    });

    it("lists supported types in error message", () => {
      try {
        validateFileType("image/png");
        throw new Error("Expected to throw");
      } catch (error) {
        const trpcError = error as TRPCError;
        expect(trpcError.message).toContain("PDF");
        expect(trpcError.message).toContain("Word");
        expect(trpcError.message).toContain("Text");
        expect(trpcError.message).toContain("Markdown");
        expect(trpcError.message).toContain("JSON");
        expect(trpcError.message).toContain("CSV");
      }
    });
  });
});

describe("validateExtensionMatchesMimeType", () => {
  describe("matching extension and MIME type", () => {
    it("accepts .pdf with application/pdf", () => {
      expect(() =>
        validateExtensionMatchesMimeType("document.pdf", "application/pdf"),
      ).not.toThrow();
    });

    it("accepts .doc with application/msword", () => {
      expect(() =>
        validateExtensionMatchesMimeType("document.doc", "application/msword"),
      ).not.toThrow();
    });

    it("accepts .docx with the openxml MIME type", () => {
      expect(() =>
        validateExtensionMatchesMimeType(
          "document.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ).not.toThrow();
    });

    it("accepts .txt with text/plain", () => {
      expect(() =>
        validateExtensionMatchesMimeType("readme.txt", "text/plain"),
      ).not.toThrow();
    });

    it("accepts .md with text/markdown", () => {
      expect(() =>
        validateExtensionMatchesMimeType("readme.md", "text/markdown"),
      ).not.toThrow();
    });

    it("accepts .markdown with text/markdown", () => {
      expect(() =>
        validateExtensionMatchesMimeType("readme.markdown", "text/markdown"),
      ).not.toThrow();
    });

    it("accepts .json with application/json", () => {
      expect(() =>
        validateExtensionMatchesMimeType("data.json", "application/json"),
      ).not.toThrow();
    });

    it("accepts .csv with text/csv", () => {
      expect(() =>
        validateExtensionMatchesMimeType("data.csv", "text/csv"),
      ).not.toThrow();
    });
  });

  describe("case insensitivity", () => {
    it("accepts uppercase extension .PDF with application/pdf", () => {
      expect(() =>
        validateExtensionMatchesMimeType("DOCUMENT.PDF", "application/pdf"),
      ).not.toThrow();
    });

    it("accepts mixed case extension .Pdf with application/pdf", () => {
      expect(() =>
        validateExtensionMatchesMimeType("Document.Pdf", "application/pdf"),
      ).not.toThrow();
    });
  });

  describe("mismatched extension and MIME type", () => {
    it("rejects .pdf with text/plain", () => {
      expectTRPCError(
        () => validateExtensionMatchesMimeType("document.pdf", "text/plain"),
        "BAD_REQUEST",
        "does not match",
      );
    });

    it("rejects .txt with application/pdf", () => {
      expectTRPCError(
        () => validateExtensionMatchesMimeType("readme.txt", "application/pdf"),
        "BAD_REQUEST",
        "does not match",
      );
    });

    it("rejects .doc with application/pdf", () => {
      expectTRPCError(
        () => validateExtensionMatchesMimeType("report.doc", "application/pdf"),
        "BAD_REQUEST",
        "does not match",
      );
    });

    it("rejects .csv with application/json", () => {
      expectTRPCError(
        () => validateExtensionMatchesMimeType("data.csv", "application/json"),
        "BAD_REQUEST",
        "does not match",
      );
    });

    it("rejects .json with text/csv", () => {
      expectTRPCError(
        () => validateExtensionMatchesMimeType("data.json", "text/csv"),
        "BAD_REQUEST",
        "does not match",
      );
    });

    it("includes extension and display name in error message", () => {
      try {
        validateExtensionMatchesMimeType("document.pdf", "text/plain");
        throw new Error("Expected to throw");
      } catch (error) {
        const trpcError = error as TRPCError;
        expect(trpcError.message).toContain(".pdf");
        expect(trpcError.message).toContain("Text");
      }
    });
  });

  describe("unknown extensions", () => {
    it("does not throw for unknown extension with any MIME type", () => {
      // Unknown extension means validMimeTypes is undefined, so the check is skipped
      expect(() =>
        validateExtensionMatchesMimeType("document.xyz", "application/pdf"),
      ).not.toThrow();
    });

    it("does not throw for file without extension", () => {
      // lastIndexOf(".") + 1 gets the full filename as "extension", which is unknown
      expect(() =>
        validateExtensionMatchesMimeType("noextension", "application/pdf"),
      ).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles file with multiple dots, uses last extension", () => {
      expect(() =>
        validateExtensionMatchesMimeType(
          "archive.backup.pdf",
          "application/pdf",
        ),
      ).not.toThrow();
    });

    it("rejects file with multiple dots when MIME type mismatches last extension", () => {
      expectTRPCError(
        () =>
          validateExtensionMatchesMimeType("archive.backup.pdf", "text/plain"),
        "BAD_REQUEST",
        "does not match",
      );
    });
  });
});
