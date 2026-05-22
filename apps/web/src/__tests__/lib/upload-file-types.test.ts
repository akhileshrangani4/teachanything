import { describe, expect, it } from "@jest/globals";
import { inferSupportedFileType } from "@/lib/upload-file-types";

describe("inferSupportedFileType", () => {
  it("uses the declared MIME type when it is already supported", () => {
    expect(inferSupportedFileType("notes.pdf", "application/pdf")).toBe(
      "application/pdf",
    );
  });

  it("infers supported image MIME types from extensions when browser MIME is missing", () => {
    expect(inferSupportedFileType("whiteboard.JPG", "")).toBe("image/jpeg");
    expect(inferSupportedFileType("scan.tif", "")).toBe("image/tiff");
  });

  it("infers supported text MIME types from extensions when browser MIME is generic", () => {
    expect(inferSupportedFileType("data.csv", "application/octet-stream")).toBe(
      "text/csv",
    );
  });

  it("uses extension-specific text MIME types when browsers report text/plain", () => {
    expect(inferSupportedFileType("notes.md", "text/plain")).toBe(
      "text/markdown",
    );
    expect(inferSupportedFileType("data.csv", "text/plain")).toBe("text/csv");
  });

  it("does not hide a supported MIME type that conflicts with the extension", () => {
    expect(inferSupportedFileType("photo.jpg", "image/png")).toBe("image/png");
  });

  it("leaves unsupported extensions unchanged for validation to reject", () => {
    expect(inferSupportedFileType("animation.gif", "image/gif")).toBe(
      "image/gif",
    );
  });
});
