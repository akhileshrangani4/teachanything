/**
 * Read an image's pixel dimensions from its header, without decoding it.
 *
 * Why this exists: a compressed image is small on disk but expands to
 * width * height * 4 bytes once decoded. A few-hundred-KB PNG can declare
 * 50,000 x 50,000 pixels -- about 10 GB of bitmap -- and the decoder inside
 * the OCR engine would try to allocate all of it (a "decompression bomb").
 * Reading the declared size first lets us refuse such a file before any
 * decoder touches it.
 *
 * Each reader returns `null` for a header it cannot parse. The caller treats
 * that as an unreadable image rather than guessing.
 */

export interface ImageInfo {
  width: number;
  height: number;
  /**
   * True when a TIFF holds more than one page. The OCR engine reads only the
   * first page of a multi-page TIFF and silently drops the rest, so the caller
   * rejects these instead of indexing part of a document.
   */
  isMultiPage: boolean;
}

function info(width: number, height: number, isMultiPage = false) {
  if (width <= 0 || height <= 0) return null;
  return { width, height, isMultiPage };
}

/** PNG: the IHDR chunk always comes first; width and height are big-endian. */
function readPng(buf: Buffer): ImageInfo | null {
  if (buf.length < 24 || buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return info(buf.readUInt32BE(16), buf.readUInt32BE(20));
}

/** JPEG markers that stand alone, with no length field after them. */
function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8);
}

/** Start-of-frame markers carry the dimensions. C4/C8/CC share the range but are not frames. */
function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 &&
    marker !== 0xc8 &&
    marker !== 0xcc
  );
}

/**
 * JPEG: walk the marker segments until a start-of-frame. Each segment is
 * 0xFF, a marker byte, then (for most markers) a 2-byte length.
 */
function readJpeg(buf: Buffer): ImageInfo | null {
  let offset = 2; // past the SOI marker
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (isStandaloneJpegMarker(marker)) {
      offset += 2;
      continue;
    }
    // Start-of-scan or end-of-image before any frame header: malformed.
    if (marker === 0xda || marker === 0xd9) return null;
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      if (offset + 9 > buf.length) return null;
      return info(buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5));
    }
    offset += 2 + length;
  }
  return null;
}

/** WebP: three bitstream variants, each storing the size differently. */
function readWebp(buf: Buffer): ImageInfo | null {
  if (buf.length < 30) return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Lossy: a 3-byte start code, then 14-bit little-endian width/height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return info(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    // Lossless: signature byte, then (width-1) and (height-1) packed as 14 bits each.
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return info((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    // Extended: 24-bit little-endian (width-1) and (height-1).
    return info(buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1);
  }
  return null;
}

const TIFF_TAG_WIDTH = 0x0100;
const TIFF_TAG_HEIGHT = 0x0101;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;

/**
 * TIFF: the header points at the first "image file directory" (IFD), a list
 * of 12-byte tag entries. Width and height are tags 256 and 257. After the
 * entries comes the offset of the next IFD -- non-zero means another page.
 */
function readTiff(buf: Buffer): ImageInfo | null {
  const isLittle = buf.toString("ascii", 0, 2) === "II";
  const u16 = (o: number) =>
    isLittle ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
  const u32 = (o: number) =>
    isLittle ? buf.readUInt32LE(o) : buf.readUInt32BE(o);

  const ifd = u32(4);
  const entryCount = u16(ifd);
  const nextIfdOffset = ifd + 2 + entryCount * 12;
  if (nextIfdOffset + 4 > buf.length) return null;

  let width = 0;
  let height = 0;
  for (let i = 0; i < entryCount; i++) {
    const entry = ifd + 2 + i * 12;
    const tag = u16(entry);
    if (tag !== TIFF_TAG_WIDTH && tag !== TIFF_TAG_HEIGHT) continue;
    const type = u16(entry + 2);
    if (type !== TIFF_TYPE_SHORT && type !== TIFF_TYPE_LONG) return null;
    const value = type === TIFF_TYPE_SHORT ? u16(entry + 8) : u32(entry + 8);
    if (tag === TIFF_TAG_WIDTH) width = value;
    else height = value;
  }
  return info(width, height, u32(nextIfdOffset) !== 0);
}

const READERS: Record<string, (buf: Buffer) => ImageInfo | null> = {
  "image/png": readPng,
  "image/jpeg": readJpeg,
  "image/webp": readWebp,
  "image/tiff": readTiff,
};

/**
 * Dimensions declared in the header of an image of the given MIME type, or
 * `null` when the header is truncated, malformed, or the type is unknown.
 * Assumes the signature has already been checked (see file-signature.ts).
 */
export function readImageInfo(buf: Buffer, mimeType: string): ImageInfo | null {
  const reader = READERS[mimeType];
  if (!reader) return null;
  try {
    return reader(buf);
  } catch {
    // Buffer reads past the end throw RangeError on a truncated header.
    return null;
  }
}
