import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { readImageInfo } from "../image-dimensions";

/**
 * The header probe is what stands between a small, maliciously crafted image
 * and a multi-gigabyte decode, so it is pinned against real files for every
 * format variant we accept, plus hand-built headers for the cases an encoder
 * will not produce on request.
 */

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/images/${name}`, import.meta.url)),
  );

describe("readImageInfo on real files", () => {
  it.each([
    ["text.png", "image/png", 640, 130],
    ["text.jpg", "image/jpeg", 640, 130],
    ["progressive.jpg", "image/jpeg", 640, 130],
    ["text.webp", "image/webp", 640, 130], // lossy, VP8
    ["text-lossless.webp", "image/webp", 640, 130], // lossless, VP8L
    ["extended.webp", "image/webp", 300, 80], // extended, VP8X
    ["text.tif", "image/tiff", 640, 130],
  ])("reads %s as %s at %ix%i", (name, mime, width, height) => {
    expect(readImageInfo(fixture(name), mime)).toEqual({
      width,
      height,
      isMultiPage: false,
    });
  });

  it("flags a TIFF with more than one page", () => {
    expect(readImageInfo(fixture("two-page.tif"), "image/tiff")).toMatchObject({
      isMultiPage: true,
    });
  });
});

/** A PNG header declaring any size, with no pixel data behind it. */
function pngHeader(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

/** A minimal big-endian ("MM") TIFF with one IFD holding width and height. */
function bigEndianTiff(width: number, height: number): Buffer {
  const buf = Buffer.alloc(8 + 2 + 2 * 12 + 4);
  buf.write("MM", 0, "ascii");
  buf.writeUInt16BE(42, 2);
  buf.writeUInt32BE(8, 4); // first IFD right after the header
  buf.writeUInt16BE(2, 8); // two entries
  // ImageWidth as LONG, ImageLength as SHORT: both types occur in the wild.
  buf.writeUInt16BE(0x0100, 10);
  buf.writeUInt16BE(4, 12);
  buf.writeUInt32BE(1, 14);
  buf.writeUInt32BE(width, 18);
  buf.writeUInt16BE(0x0101, 22);
  buf.writeUInt16BE(3, 24);
  buf.writeUInt32BE(1, 26);
  buf.writeUInt16BE(height, 30); // SHORT is left-justified in the value field
  buf.writeUInt32BE(0, 34); // no next IFD
  return buf;
}

describe("readImageInfo on crafted headers", () => {
  it("reports the size a header declares without decoding any pixels", () => {
    // ~10 GB once decoded; the header alone is 33 bytes.
    expect(readImageInfo(pngHeader(50_000, 50_000), "image/png")).toEqual({
      width: 50_000,
      height: 50_000,
      isMultiPage: false,
    });
  });

  it("reads a big-endian TIFF with mixed SHORT and LONG tags", () => {
    expect(readImageInfo(bigEndianTiff(2550, 3300), "image/tiff")).toEqual({
      width: 2550,
      height: 3300,
      isMultiPage: false,
    });
  });

  it("returns null for a zero dimension", () => {
    expect(readImageInfo(pngHeader(0, 100), "image/png")).toBeNull();
  });

  it.each(["text.png", "text.jpg", "text.webp", "text.tif"])(
    "returns null instead of throwing for a truncated %s",
    (name) => {
      const mime = {
        png: "image/png",
        jpg: "image/jpeg",
        webp: "image/webp",
        tif: "image/tiff",
      }[name.split(".")[1]!]!;
      expect(readImageInfo(fixture(name).subarray(0, 12), mime)).toBeNull();
    },
  );

  it("returns null for a JPEG whose scan data starts before any frame header", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0, 0, 0, 0]);
    expect(readImageInfo(buf, "image/jpeg")).toBeNull();
  });

  it("returns null for a TIFF whose directory points past the end of the file", () => {
    const buf = bigEndianTiff(10, 10);
    buf.writeUInt32BE(10_000, 4);
    expect(readImageInfo(buf, "image/tiff")).toBeNull();
  });

  it("returns null for a MIME type it has no reader for", () => {
    expect(readImageInfo(fixture("text.png"), "image/gif")).toBeNull();
  });
});
