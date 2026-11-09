import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Worker lifecycle and failure handling for image OCR, with the tesseract.js
 * engine replaced by a fake. The fake lets these tests do what a real engine
 * cannot be made to do on demand: hang forever, fail mid-job, or start slowly.
 *
 * The real engine is exercised in image-ocr-engine.test.ts.
 */

type FakeWorker = {
  recognize: jest.Mock<(image: Buffer) => Promise<{ data: { text: string } }>>;
  terminate: jest.Mock<() => Promise<void>>;
};

const mockCreateWorker =
  jest.fn<
    (
      lang: string,
      oem: number,
      options: Record<string, unknown>,
    ) => Promise<FakeWorker>
  >();

jest.unstable_mockModule("tesseract.js", () => ({
  createWorker: mockCreateWorker,
  OEM: { LSTM_ONLY: 1 },
}));

const { recognizeImageText, OCR_MAX_PIXELS, OCR_TIMEOUT_MS } =
  await import("../image-ocr");

function fakeWorker(
  recognize: () => Promise<{ data: { text: string } }>,
): FakeWorker {
  return {
    recognize: jest.fn(recognize),
    terminate: jest.fn(() => Promise.resolve()),
  };
}

/** A PNG header declaring the given size. The fake engine never decodes it. */
function png(width = 640, height = 130): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

const never = () => new Promise<never>(() => {});

describe("recognizeImageText", () => {
  beforeEach(() => {
    mockCreateWorker.mockReset();
  });

  it("returns the recognized text and terminates the worker", async () => {
    const worker = fakeWorker(async () => ({ data: { text: "Mitosis\n" } }));
    mockCreateWorker.mockResolvedValue(worker);

    await expect(recognizeImageText(png(), "image/png")).resolves.toBe(
      "Mitosis\n",
    );
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("configures the engine to run offline, without writing to disk or crashing the process", async () => {
    mockCreateWorker.mockResolvedValue(
      fakeWorker(async () => ({ data: { text: "x" } })),
    );

    await recognizeImageText(png(), "image/png");

    const [lang, , options] = mockCreateWorker.mock.calls[0]!;
    expect(lang).toBe("eng");
    expect(options.cacheMethod).toBe("none");
    expect(options.gzip).toBe(true);
    // Removing this turns one corrupt upload into a process crash; see the
    // comment in createOcrWorker and the engine test for a corrupt image.
    expect(typeof options.errorHandler).toBe("function");
    // A local directory that really holds the model -- not a CDN URL.
    const langPath = options.langPath as string;
    expect(langPath).not.toMatch(/^https?:/);
    expect(existsSync(join(langPath, "eng.traineddata.gz"))).toBe(true);
  });

  it("refuses an image over the pixel limit before starting the engine", async () => {
    const side = Math.ceil(Math.sqrt(OCR_MAX_PIXELS)) + 1;

    await expect(
      recognizeImageText(png(side, side), "image/png"),
    ).rejects.toThrow("Image too large for text recognition");
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it("refuses an image whose header cannot be read before starting the engine", async () => {
    const truncated = png().subarray(0, 16);

    await expect(recognizeImageText(truncated, "image/png")).rejects.toThrow(
      "Invalid image",
    );
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it("passes on an engine failure and still terminates the worker", async () => {
    const worker = fakeWorker(() =>
      Promise.reject(new Error("Error attempting to read image.")),
    );
    mockCreateWorker.mockResolvedValue(worker);

    await expect(recognizeImageText(png(), "image/png")).rejects.toThrow(
      "Error attempting to read image.",
    );
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("passes on a failure to start the engine", async () => {
    mockCreateWorker.mockRejectedValue(new Error("wasm failed to load"));

    await expect(recognizeImageText(png(), "image/png")).rejects.toThrow(
      "wasm failed to load",
    );
  });

  it("times out a recognition that never finishes and terminates the worker", async () => {
    const worker = fakeWorker(never);
    mockCreateWorker.mockResolvedValue(worker);

    await expect(
      recognizeImageText(png(), "image/png", { timeoutMs: 50 }),
    ).rejects.toThrow("Image text recognition timed out");
    // Terminating is what actually stops the CPU work; the rejection alone
    // would leave the worker thread running.
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("terminates a worker that finishes starting only after the timeout", async () => {
    const worker = fakeWorker(async () => ({ data: { text: "late" } }));
    let finishStarting!: (w: FakeWorker) => void;
    mockCreateWorker.mockReturnValue(
      new Promise((resolve) => (finishStarting = resolve)),
    );

    await expect(
      recognizeImageText(png(), "image/png", { timeoutMs: 20 }),
    ).rejects.toThrow("timed out");

    finishStarting(worker);
    await new Promise((resolve) => setImmediate(resolve));
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.recognize).not.toHaveBeenCalled();
  });

  it("leaves time for the pipeline's own 60s extraction timeout to never be the one that fires", () => {
    // The pipeline's timeout cannot stop the worker; this one can. See the
    // comment on OCR_TIMEOUT_MS.
    expect(OCR_TIMEOUT_MS).toBeLessThan(60_000);
  });
});
