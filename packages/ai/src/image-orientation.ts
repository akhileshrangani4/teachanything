/**
 * JPEG EXIF orientation, made readable to tesseract.js.
 *
 * Phones often save a photo sideways and record the turn in an EXIF
 * "Orientation" tag (values 1-8: four rotations, each optionally mirrored)
 * instead of rotating the pixels. The tesseract.js engine applies that tag
 * correctly for all eight values -- but tesseract.js 7 only *finds* it with a
 * byte pattern that matches big-endian ("MM") EXIF in the first 500 bytes
 * (src/worker-script/utils/setImage.js). Little-endian ("II") EXIF, which many
 * cameras write, is never detected, so those photos are read sideways and
 * produce garbage.
 *
 * The fix reads the tag here, in either byte order, and inserts a minimal
 * big-endian copy of it at the start of the file -- the exact form tesseract.js
 * detects -- so the engine performs the rotation itself. Pixel data is never
 * touched, and nothing changes for an image without an orientation to apply.
 */

const ORIENTATION_TAG = 0x0112;
const TIFF_TYPE_SHORT = 3;
const EXIF_HEADER = Buffer.from("Exif\0\0", "binary");

/** Reads the Orientation tag from IFD0 of a TIFF structure (the body of EXIF). */
function readTiffOrientation(tiff: Buffer): number {
  const order = tiff.toString("ascii", 0, 2);
  if (order !== "II" && order !== "MM") return 1;
  const isLittle = order === "II";
  const u16 = (o: number) =>
    isLittle ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o);
  const u32 = (o: number) =>
    isLittle ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o);
  if (u16(2) !== 42) return 1;

  const ifd = u32(4);
  const entryCount = u16(ifd);
  for (let i = 0; i < entryCount; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) !== ORIENTATION_TAG) continue;
    if (u16(entry + 2) !== TIFF_TYPE_SHORT || u32(entry + 4) !== 1) return 1;
    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

/**
 * The EXIF orientation (1-8) of a JPEG, or 1 -- "as stored, no change" -- when
 * the buffer is not a JPEG, has no EXIF, or its metadata is malformed or
 * truncated. Never throws.
 */
export function readJpegOrientation(buf: Buffer): number {
  try {
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
    let offset = 2;
    while (offset + 4 <= buf.length) {
      if (buf[offset] !== 0xff) return 1;
      const marker = buf[offset + 1]!;
      if (marker === 0xff) {
        offset += 1; // fill byte
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        offset += 2; // standalone marker: no length field
        continue;
      }
      // Metadata segments all come before the image data starts.
      if (marker === 0xda || marker === 0xd9) return 1;
      const end = offset + 2 + buf.readUInt16BE(offset + 2);
      if (end > buf.length || end < offset + 4) return 1;
      const body = buf.subarray(offset + 4, end);
      if (marker === 0xe1 && body.subarray(0, 6).equals(EXIF_HEADER)) {
        return readTiffOrientation(body.subarray(6));
      }
      offset = end;
    }
    return 1;
  } catch {
    // A truncated or malformed structure reads past the end and throws.
    return 1;
  }
}

/** A JPEG APP1 segment holding big-endian EXIF with only the Orientation tag. */
function bigEndianOrientationSegment(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write("MM", 0, "ascii");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // IFD0 right after the header
  tiff.writeUInt16BE(1, 8); // one entry
  tiff.writeUInt16BE(ORIENTATION_TAG, 10);
  tiff.writeUInt16BE(TIFF_TYPE_SHORT, 12);
  tiff.writeUInt32BE(1, 14); // count
  tiff.writeUInt16BE(orientation, 18); // value, left-justified
  tiff.writeUInt32BE(0, 22); // no next IFD
  const body = Buffer.concat([EXIF_HEADER, tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
}

/**
 * The JPEG with its orientation made detectable by tesseract.js, or the same
 * buffer, untouched, when there is no rotation or mirroring to apply.
 *
 * The segment goes straight after the start-of-image marker so it always falls
 * inside the 500 bytes tesseract.js searches, however large the segments that
 * follow. tesseract.js uses the first match, which is this one, so the engine
 * rotates exactly once even when the original big-endian tag was already
 * detectable. Returns a new buffer; never mutates input.
 */
export function withDetectableOrientation(buf: Buffer): Buffer {
  const orientation = readJpegOrientation(buf);
  if (orientation === 1) return buf;
  return Buffer.concat([
    buf.subarray(0, 2),
    bigEndianOrientationSegment(orientation),
    buf.subarray(2),
  ]);
}
