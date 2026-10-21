import { describe, it, expect } from "@jest/globals";

import { assertFileSignature } from "../file-signature";

/**
 * Nothing upstream checks that an upload's bytes are the type it was declared
 * as: `validateExtensionMatchesMimeType` compares the MIME to the file NAME,
 * and the client uploads straight to storage. These cases pin the check that
 * closes that gap, the one that keeps PDF bytes uploaded as a .pptx away from
 * officeparser's PDF parser.
 */

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const pdf = () => Buffer.from("%PDF-1.7\nbody");
const zip = () =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("body")]);
const ole2 = () =>
  Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.from("body"),
  ]);
const text = () => Buffer.from("Week 1 reading: Butler, Gender Trouble.");
const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
const webp = (animated = false) =>
  Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.alloc(4),
    Buffer.from("WEBP"),
    Buffer.from(animated ? "ANIM" : "VP8 "),
  ]);
const gif = (frames: number) => {
  const header = Buffer.concat([
    Buffer.from("GIF89a"),
    Buffer.from([1, 0, 1, 0, 0, 0, 0]),
  ]);
  const frame = Buffer.from([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0]);
  return Buffer.concat([
    header,
    ...Array.from({ length: frames }, () => frame),
    Buffer.from([0x3b]),
  ]);
};

describe("assertFileSignature", () => {
  it("accepts each type carrying its own signature", () => {
    const accepted: Array<[string, Buffer]> = [
      [PDF_MIME, pdf()],
      [DOCX_MIME, zip()],
      [PPTX_MIME, zip()],
      [DOC_MIME, ole2()],
      // A .docx renamed to .doc. It fails later in mammoth, but rejecting it
      // here would break uploads that work today.
      [DOC_MIME, zip()],
      ["text/plain", text()],
      ["text/markdown", Buffer.from("# Syllabus")],
      ["text/csv", Buffer.from("name,grade\n")],
      ["application/json", Buffer.from('{"a":1}')],
      ["image/png", png()],
      ["image/jpeg", jpeg()],
      ["image/webp", webp()],
      ["image/gif", gif(1)],
    ];

    for (const [mime, buffer] of accepted) {
      expect(() => assertFileSignature(buffer, mime)).not.toThrow();
    }
  });

  it("rejects bytes that belong to a different container", () => {
    const rejected: Array<[string, Buffer]> = [
      // The case that reaches pdfjs-dist through officeparser's own sniffing.
      [PPTX_MIME, pdf()],
      [DOCX_MIME, pdf()],
      [PDF_MIME, zip()],
      [PDF_MIME, ole2()],
      [PPTX_MIME, ole2()],
      [PDF_MIME, text()],
      [DOCX_MIME, text()],
      ["image/png", jpeg()],
      ["image/jpeg", png()],
      ["image/webp", png()],
      ["image/gif", png()],
    ];

    for (const [mime, buffer] of rejected) {
      expect(() => assertFileSignature(buffer, mime)).toThrow(
        /do not match the file type/,
      );
    }
  });

  it("rejects a binary container uploaded as a text file", () => {
    expect(() => assertFileSignature(pdf(), "text/plain")).toThrow(/a PDF/);
    expect(() => assertFileSignature(zip(), "text/csv")).toThrow(
      /a zip or Office document/,
    );
    expect(() => assertFileSignature(ole2(), "application/json")).toThrow(
      /a legacy Office document/,
    );
  });

  it("leaves merely unusual text alone", () => {
    // Extraction strips control characters, so a file that is only odd should
    // still process. The text check looks for known containers, not for a
    // general verdict on whether the bytes look binary.
    expect(() =>
      assertFileSignature(
        Buffer.from("\u0000\u0001odd but text"),
        "text/plain",
      ),
    ).not.toThrow();
  });

  it("rejects an empty buffer whatever it claims to be", () => {
    for (const mime of [PDF_MIME, PPTX_MIME, "text/plain"]) {
      expect(() => assertFileSignature(Buffer.alloc(0), mime)).toThrow(
        /Empty file/,
      );
    }
  });

  it("rejects animated image formats", () => {
    expect(() => assertFileSignature(gif(2), "image/gif")).toThrow(
      /Animated GIF/,
    );
    expect(() => assertFileSignature(webp(true), "image/webp")).toThrow(
      /Animated WebP/,
    );
  });

  it("rejects a buffer too short to carry a signature", () => {
    expect(() =>
      assertFileSignature(Buffer.from([0x50, 0x4b]), PPTX_MIME),
    ).toThrow(/do not match the file type/);
    expect(() => assertFileSignature(Buffer.from("%PD"), PDF_MIME)).toThrow(
      /do not match the file type/,
    );
  });

  it("passes a type it has no signature for", () => {
    // `extractContent` rejects unsupported types itself; this check is not the
    // allow-list and must not start acting like one.
    expect(() =>
      assertFileSignature(Buffer.from("anything"), "application/zip"),
    ).not.toThrow();
  });

  it("counts GIF frames by walking blocks, not by matching image bytes", () => {
    // A global color table shifts the first frame's offset; the frame walker
    // must skip it rather than read the palette as block structure.
    const withGlobalColorTable = Buffer.concat([
      Buffer.from("GIF89a"),
      Buffer.from([1, 0, 1, 0, 0x81, 0, 0]),
      Buffer.from([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0]),
      Buffer.from([0x3b]),
    ]);
    expect(() =>
      assertFileSignature(withGlobalColorTable, "image/gif"),
    ).not.toThrow();

    // Extension blocks (0x21) sit between frames and must be skipped down to
    // their terminator rather than read as a frame or as image data.
    const withExtensionBlock = Buffer.concat([
      Buffer.from("GIF89a"),
      Buffer.from([1, 0, 1, 0, 0, 0, 0]),
      Buffer.from([0x21, 0x02, 0x01, 0x00]),
      Buffer.from([0x3b]),
    ]);
    expect(() =>
      assertFileSignature(withExtensionBlock, "image/gif"),
    ).not.toThrow();
  });

  it("accepts a GIF too short to carry frames", () => {
    // Shorter than the 13-byte logical screen descriptor: nothing to count,
    // so the single-frame assumption holds.
    expect(() =>
      assertFileSignature(Buffer.from("GIF89a"), "image/gif"),
    ).not.toThrow();
  });

  it("rejects a RIFF container that is not WebP", () => {
    const riff = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WAVE"),
    ]);
    expect(() => assertFileSignature(riff, "image/webp")).toThrow(
      /do not match the file type/,
    );
  });
});
