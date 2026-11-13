import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Worker } from "tesseract.js";
import { readImageInfo } from "./image-dimensions";

/**
 * Optical character recognition (OCR) for uploaded images, using tesseract.js:
 * the Tesseract engine compiled to WebAssembly. It runs inside this process on
 * a worker thread -- no system binary, no external API, and the image never
 * leaves the server.
 */

/**
 * Largest image we will OCR. Decoded, an image costs about 4 bytes per pixel,
 * and recognition time grows with area: a dense, full page of text at 7.7 MP
 * measured ~8 s. 30 MP admits a 24 MP camera photo (a 300 DPI letter-size scan
 * is ~8.4 MP) while keeping the worst case well inside `OCR_TIMEOUT_MS`.
 */
export const OCR_MAX_PIXELS = 30_000_000;

/**
 * Hard limit for one image, worker start-up included.
 *
 * Must stay BELOW the pipeline's `EXTRACTION_TIMEOUT_MS` (60 s, in
 * apps/web/src/server/file-processor/pipeline.ts). That outer timeout can only
 * stop waiting for the promise; it cannot stop the worker thread, which would
 * keep burning CPU for the rest of the invocation. This one fires first and
 * terminates the worker, which does stop it.
 */
export const OCR_TIMEOUT_MS = 45_000;

/** The gzipped English LSTM model inside `@tesseract.js-data/eng`. */
const MODEL_FILE = "eng.traineddata.gz";

/**
 * Directory holding the English model (`eng.traineddata.gz`), shipped as an
 * npm package so it is read from disk instead of being downloaded from a CDN
 * on every cold start.
 *
 * The package's own `langPath` points at its 11 MB legacy+LSTM model; we use
 * the 2.9 MB integer-quantized LSTM model in the sibling folder, which is the
 * model tesseract.js itself picks for LSTM-only recognition.
 */
async function englishModelDir(): Promise<string> {
  const { default: eng } = await import("@tesseract.js-data/eng");
  const dir = join(dirname(eng.langPath), "4.0.0_best_int");
  // Checked BEFORE a worker exists, because tesseract.js 7 cannot clean up
  // after this failure itself: when the model fails to load, createWorker()
  // never settles, and the worker thread it already spawned is never handed
  // back, so nothing can terminate it. Failing here means a deployment that
  // lost the model gets a clear error and no stray thread.
  try {
    await access(join(dir, MODEL_FILE));
  } catch {
    throw new Error(`OCR language data not found: ${join(dir, MODEL_FILE)}`);
  }
  return dir;
}

async function createOcrWorker(): Promise<Worker> {
  const { createWorker, OEM } = await import("tesseract.js");
  return createWorker("eng", OEM.LSTM_ONLY, {
    langPath: await englishModelDir(),
    gzip: true,
    // The default caches the model by WRITING it to the working directory,
    // which is read-only in a serverless deployment. The model is already on
    // local disk, so there is nothing to gain from a cache.
    cacheMethod: "none",
    // Without this, tesseract.js rethrows every failed job from inside the
    // worker's message listener, where no caller's try/catch can reach it: a
    // single corrupt image becomes an uncaught exception that kills the whole
    // process. The rejection still reaches whoever awaited the job.
    errorHandler: () => {},
    logger: () => {},
  });
}

/** Rejects up front, before any decoder runs, an image we cannot safely OCR. */
function assertImageIsProcessable(buffer: Buffer, mimeType: string): void {
  const image = readImageInfo(buffer, mimeType);
  if (!image) {
    throw new Error(
      "Invalid image: the file is damaged or could not be read as an image",
    );
  }
  if (image.isMultiPage) {
    throw new Error(
      "Multi-page TIFF images are not supported: only the first page would be read",
    );
  }
  const pixels = image.width * image.height;
  if (pixels > OCR_MAX_PIXELS) {
    throw new Error(
      `Image too large for text recognition: ${image.width}x${image.height} pixels exceeds the ${OCR_MAX_PIXELS / 1_000_000} megapixel limit`,
    );
  }
}

/**
 * Recognize the text in an image and return it raw (unsanitized, possibly
 * empty -- the caller decides what "no text" means).
 *
 * Throws on an unreadable, oversized or multi-page image, on missing model
 * data, on an engine failure, and after `timeoutMs`. Once tesseract.js hands
 * a worker back, it is terminated on every path: success, failure, timeout,
 * and a start-up that only finishes after the timeout. A start-up that never
 * finishes yields no worker to terminate: tesseract.js 7 offers no handle,
 * cancel or timeout before then. The model check above removes the likely
 * cause (a missing file). A model file that exists but is corrupted is not
 * caught by it, and tesseract.js 7 then fails in one of two ways:
 * - truncated: start-up never finishes; this fails at the deadline and leaves
 *   one idle thread until the process exits;
 * - not valid model data: the worker answers twice and tesseract.js throws an
 *   uncaught TypeError from its message listener, which `errorHandler` does
 *   not cover. Plain Node exits; the Next.js server logs it and keeps serving,
 *   and this call fails at the deadline.
 * A promise timeout alone would not be enough: it stops the waiting, not the
 * worker thread, which is why the deadline terminates it.
 */
export async function recognizeImageText(
  buffer: Buffer,
  mimeType: string,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? OCR_TIMEOUT_MS;
  assertImageIsProcessable(buffer, mimeType);

  // Held in an object, not a `let`, so the `finally` below sees the worker
  // assigned inside the async closure.
  const state: { worker: Worker | null; isFinished: boolean } = {
    worker: null,
    isFinished: false,
  };

  const work = (async () => {
    const worker = await createOcrWorker();
    if (state.isFinished) {
      // Timed out while the worker was still starting; nobody will use it.
      await worker.terminate();
      return "";
    }
    state.worker = worker;
    const { data } = await worker.recognize(buffer);
    return data.text ?? "";
  })();
  // After a timeout nothing awaits `work`; keep its late outcome from
  // surfacing as an unhandled rejection.
  work.catch(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Image text recognition timed out after ${timeoutMs / 1000}s`,
          ),
        ),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
    state.isFinished = true;
    // A terminated worker's pending job never settles, which is why the
    // deadline above rejects on its own instead of waiting for it.
    await state.worker?.terminate().catch(() => {});
  }
}
