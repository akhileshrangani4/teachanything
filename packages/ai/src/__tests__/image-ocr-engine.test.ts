import { jest, describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { RAGService } from "../rag-service";

/**
 * Image OCR end to end through the REAL tesseract.js engine and the bundled
 * English model: no mocks, no network. These are the paths the ingestion
 * pipeline takes -- `extractAndChunk` is exactly what processFile() calls.
 *
 * Each case starts and terminates its own worker (~0.3 s on a laptop).
 */

jest.setTimeout(30_000);

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/images/${name}`, import.meta.url)),
  );

const service = new RAGService();
const EXPECTED = "Photosynthesis converts light\ninto chemical energy.";

describe("image OCR with the real engine", () => {
  it.each([
    ["text.png", "image/png"],
    ["text.jpg", "image/jpeg"],
    ["text.webp", "image/webp"],
    ["text.tif", "image/tiff"],
  ])("reads the text in %s", async (name, mime) => {
    await expect(service.extractContent(fixture(name), mime)).resolves.toBe(
      EXPECTED,
    );
  });

  it("produces chunks the pipeline can embed, without page numbers", async () => {
    const chunks = await service.extractAndChunk(
      fixture("text.png"),
      "image/png",
    );

    expect(chunks).toEqual([{ content: EXPECTED }]);
  });

  it("reports an image with no text as having no readable text", async () => {
    await expect(
      service.extractContent(fixture("blank.png"), "image/png"),
    ).rejects.toThrow("Image contains no readable text content");
  });

  it("turns a damaged image into an ordinary error instead of crashing the process", async () => {
    // The header survives, so this gets past the dimension probe and into the
    // decoder, which fails. Without the worker's errorHandler, tesseract.js
    // rethrows that failure as an uncaught exception and Jest reports a crash.
    const damaged = fixture("text.png").subarray(0, 100);

    await expect(service.extractContent(damaged, "image/png")).rejects.toThrow(
      "Failed to extract content",
    );
  });

  it("rejects a multi-page TIFF rather than silently reading only page one", async () => {
    await expect(
      service.extractContent(fixture("two-page.tif"), "image/tiff"),
    ).rejects.toThrow("Multi-page TIFF images are not supported");
  });

  it("rejects a file whose bytes are not the image type it claims", async () => {
    await expect(
      service.extractContent(fixture("text.png"), "image/jpeg"),
    ).rejects.toThrow("Invalid JPEG image file");
  });
});

/**
 * Phone photos saved sideways or mirrored, with the turn recorded in EXIF.
 * tesseract.js 7 detects only big-endian EXIF on its own; see
 * image-orientation.ts. Every orientation is checked with little-endian EXIF,
 * the case it misses, plus one big-endian control that must not be rotated
 * twice. Each fixture was verified upright with Pillow's exif_transpose.
 */
describe("image OCR of EXIF-oriented photos with the real engine", () => {
  it.each([
    ["exif-orientation-1-le.jpg", "upright"],
    ["exif-orientation-2-le.jpg", "mirrored"],
    ["exif-orientation-3-le.jpg", "upside down"],
    ["exif-orientation-4-le.jpg", "upside down, mirrored"],
    ["exif-orientation-5-le.jpg", "sideways, mirrored"],
    ["exif-orientation-6-le.jpg", "sideways"],
    ["exif-orientation-7-le.jpg", "sideways, mirrored"],
    ["exif-orientation-8-le.jpg", "sideways"],
    ["exif-orientation-6-be.jpg", "sideways, big-endian EXIF"],
  ])("reads %s (%s) the right way up", async (name) => {
    await expect(
      service.extractContent(fixture(name), "image/jpeg"),
    ).resolves.toBe(EXPECTED);
  });
});
