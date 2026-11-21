import { describe, it, expect } from "@jest/globals";

import {
  readJpegOrientation,
  withDetectableOrientation,
} from "../image-orientation";

/**
 * JPEG EXIF orientation, read in both byte orders and re-encoded in the form
 * tesseract.js 7 detects. Buffers are built by hand so every malformed case is
 * exact; the real engine is exercised in image-ocr-engine.test.ts.
 */

const SOI = Buffer.from([0xff, 0xd8]);
/** Stand-in for everything after the metadata: a start-of-scan and some bytes. */
const SCAN = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x11, 0x22, 0xff, 0xd9]);

function segment(marker: number, body: Buffer): Buffer {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
}

type Entry = { tag: number; type: number; count: number; value: number };

/** EXIF (TIFF) body with the given IFD0 entries, in either byte order. */
function exifBody(isLittle: boolean, entries: Entry[]): Buffer {
  const tiff = Buffer.alloc(8 + 2 + entries.length * 12 + 4);
  const u16 = (v: number, o: number) =>
    isLittle ? tiff.writeUInt16LE(v, o) : tiff.writeUInt16BE(v, o);
  const u32 = (v: number, o: number) =>
    isLittle ? tiff.writeUInt32LE(v, o) : tiff.writeUInt32BE(v, o);
  tiff.write(isLittle ? "II" : "MM", 0, "ascii");
  u16(42, 2);
  u32(8, 4);
  u16(entries.length, 8);
  entries.forEach((e, i) => {
    const at = 10 + i * 12;
    u16(e.tag, at);
    u16(e.type, at + 2);
    u32(e.count, at + 4);
    u16(e.value, at + 8); // SHORT values are left-justified in both orders
  });
  return Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
}

const orientationEntry = (value: number): Entry => ({
  tag: 0x0112,
  type: 3,
  count: 1,
  value,
});

/** A JPEG with an EXIF segment carrying the given orientation. */
function jpegWithOrientation(
  value: number,
  isLittle: boolean,
  before: Buffer[] = [],
): Buffer {
  return Buffer.concat([
    SOI,
    ...before,
    segment(0xe1, exifBody(isLittle, [orientationEntry(value)])),
    SCAN,
  ]);
}

/** tesseract.js 7's own detection, copied from src/worker-script/utils/setImage.js. */
function tesseractJsDetects(buf: Buffer): number {
  const match = Array.from(buf.subarray(0, 500))
    .join(" ")
    .match(/1 18 0 3 0 0 0 1 0 (\d)/);
  return parseInt(match?.[1] ?? "", 10) || 1;
}

const JFIF = segment(
  0xe0,
  Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "binary"),
);

describe("readJpegOrientation", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "reads orientation %i in both byte orders",
    (value) => {
      expect(readJpegOrientation(jpegWithOrientation(value, true))).toBe(value);
      expect(readJpegOrientation(jpegWithOrientation(value, false))).toBe(
        value,
      );
    },
  );

  it("finds the EXIF segment after JFIF and other APP segments", () => {
    const icc = segment(0xe2, Buffer.alloc(40, 7));
    expect(readJpegOrientation(jpegWithOrientation(6, true, [JFIF, icc]))).toBe(
      6,
    );
  });

  it("finds the tag among other IFD0 entries, as cameras write them", () => {
    const body = exifBody(true, [
      { tag: 0x010f, type: 2, count: 4, value: 0x6143 }, // Make
      { tag: 0x0110, type: 2, count: 4, value: 0x6158 }, // Model
      orientationEntry(8),
      { tag: 0x011a, type: 5, count: 1, value: 0 }, // XResolution
    ]);
    const jpeg = Buffer.concat([SOI, segment(0xe1, body), SCAN]);
    expect(readJpegOrientation(jpeg)).toBe(8);
  });

  it("returns 1 when there is no EXIF, no orientation tag, or no JPEG", () => {
    expect(readJpegOrientation(Buffer.concat([SOI, JFIF, SCAN]))).toBe(1);
    const noTag = exifBody(false, [
      { tag: 0x010f, type: 2, count: 4, value: 0 },
    ]);
    expect(
      readJpegOrientation(Buffer.concat([SOI, segment(0xe1, noTag), SCAN])),
    ).toBe(1);
    expect(
      readJpegOrientation(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    ).toBe(1);
    expect(readJpegOrientation(Buffer.alloc(0))).toBe(1);
  });

  it("ignores an APP1 that is XMP rather than EXIF", () => {
    const xmp = segment(
      0xe1,
      Buffer.from("http://ns.adobe.com/xap/1.0/\0<x/>"),
    );
    expect(readJpegOrientation(Buffer.concat([SOI, xmp, SCAN]))).toBe(1);
  });

  it("does not look for metadata after the image data starts", () => {
    const late = Buffer.concat([
      SOI,
      SCAN.subarray(0, 6),
      segment(0xe1, exifBody(true, [orientationEntry(6)])),
    ]);
    expect(readJpegOrientation(late)).toBe(1);
  });

  describe("malformed metadata never throws and means no rotation", () => {
    const valid = jpegWithOrientation(6, true);
    const cases: Array<[string, Buffer]> = [
      ["a segment length running past the end", valid.subarray(0, 20)],
      [
        "an IFD claiming more entries than the segment holds",
        (() => {
          const body = exifBody(true, [
            { tag: 0x010f, type: 2, count: 4, value: 0 },
          ]);
          body.writeUInt16LE(5, 6 + 8); // entry count, after "Exif\0\0" + header
          return Buffer.concat([SOI, segment(0xe1, body), SCAN]);
        })(),
      ],
      [
        "an unknown byte order",
        Buffer.concat([
          SOI,
          segment(0xe1, Buffer.from("Exif\0\0XX\0*\0\0\0\x08", "binary")),
          SCAN,
        ]),
      ],
      [
        "a wrong TIFF magic number",
        (() => {
          const b = Buffer.from(valid);
          b.writeUInt16LE(43, 2 + 4 + 6 + 2); // after SOI, APP1 header, "Exif\0\0", "II"
          return b;
        })(),
      ],
      [
        "an IFD offset pointing past the end",
        (() => {
          const b = Buffer.from(valid);
          b.writeUInt32LE(0xfffffff0, 2 + 4 + 6 + 4);
          return b;
        })(),
      ],
      [
        "the tag stored as LONG instead of SHORT",
        Buffer.concat([
          SOI,
          segment(
            0xe1,
            exifBody(true, [{ tag: 0x0112, type: 4, count: 1, value: 6 }]),
          ),
          SCAN,
        ]),
      ],
      ["an out-of-range value", jpegWithOrientation(9, true)],
      ["a zero value", jpegWithOrientation(0, false)],
      [
        "a segment length below its own header",
        Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x01, 0xff, 0xd9]),
      ],
      [
        "bytes that are not a marker",
        Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00]),
      ],
    ];

    it.each(cases)("%s", (_label, buf) => {
      expect(() => readJpegOrientation(buf)).not.toThrow();
      expect(readJpegOrientation(buf)).toBe(1);
    });
  });
});

describe("withDetectableOrientation", () => {
  it("returns the very same buffer when there is nothing to rotate", () => {
    const upright = jpegWithOrientation(1, true);
    const noExif = Buffer.concat([SOI, JFIF, SCAN]);
    const notJpeg = Buffer.from("not an image");
    expect(withDetectableOrientation(upright)).toBe(upright);
    expect(withDetectableOrientation(noExif)).toBe(noExif);
    expect(withDetectableOrientation(notJpeg)).toBe(notJpeg);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])(
    "makes little-endian orientation %i detectable by tesseract.js",
    (value) => {
      const original = jpegWithOrientation(value, true, [JFIF]);
      // The bug being worked around: tesseract.js cannot see it as written.
      expect(tesseractJsDetects(original)).toBe(1);

      const result = withDetectableOrientation(original);
      expect(tesseractJsDetects(result)).toBe(value);
      expect(readJpegOrientation(result)).toBe(value);
    },
  );

  it("inserts one segment after the start-of-image marker and keeps every original byte", () => {
    const original = jpegWithOrientation(6, true, [JFIF]);
    const copy = Buffer.from(original);
    const result = withDetectableOrientation(original);

    expect(result.subarray(0, 2)).toEqual(SOI);
    expect(result.subarray(2, 4)).toEqual(Buffer.from([0xff, 0xe1]));
    const inserted = result.readUInt16BE(4) + 2;
    expect(result.length).toBe(original.length + inserted);
    expect(result.subarray(2 + inserted)).toEqual(original.subarray(2));
    expect(original).toEqual(copy); // input not mutated
  });

  it("keeps the value of an already-detectable big-endian tag, so rotation happens once", () => {
    const original = jpegWithOrientation(3, false);
    expect(tesseractJsDetects(original)).toBe(3);
    expect(tesseractJsDetects(withDetectableOrientation(original))).toBe(3);
  });

  it("stays within the 500 bytes tesseract.js searches, even behind large segments", () => {
    const bigIcc = segment(0xe2, Buffer.alloc(4000, 1));
    const original = jpegWithOrientation(8, true, [JFIF, bigIcc]);
    expect(tesseractJsDetects(withDetectableOrientation(original))).toBe(8);
  });
});
