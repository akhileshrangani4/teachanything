import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { transcribeAudio, TranscriptionError } from "../transcription";

const originalFetch = globalThis.fetch;

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("transcribeAudio", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("posts multipart audio and returns trimmed text + metadata", async () => {
    const calls: { url: string; body: FormData; auth: string | null }[] = [];
    mockFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: typeof input === "string" ? input : input.toString(),
        body: init?.body as FormData,
        auth: (init?.headers as Record<string, string>).Authorization ?? null,
      });
      return jsonResponse({
        text: "  hello world  ",
        language: "english",
        duration: 2.5,
      });
    }) as typeof fetch);

    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const result = await transcribeAudio({
      apiKey: "sk-test",
      audio,
      filename: "rec.webm",
    });

    expect(result).toEqual({
      text: "hello world",
      language: "english",
      durationSeconds: 2.5,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.auth).toBe("Bearer sk-test");
    expect(calls[0]?.url).toContain("/v1/audio/transcriptions");
    expect(calls[0]?.body.get("model")).toBe("whisper-1");
    expect(calls[0]?.body.get("response_format")).toBe("verbose_json");
    expect(calls[0]?.body.get("language")).toBeNull();
  });

  it("forwards the language hint when provided", async () => {
    let captured: FormData | undefined;
    mockFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured = init?.body as FormData;
      return jsonResponse({ text: "hola" });
    }) as typeof fetch);

    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await transcribeAudio({
      apiKey: "sk-test",
      audio,
      filename: "rec.webm",
      language: "es",
    });

    expect(captured?.get("language")).toBe("es");
  });

  it("throws TranscriptionError with provider_rate_limit on HTTP 429", async () => {
    mockFetch(
      (async () =>
        new Response("rate limited", { status: 429 })) as typeof fetch,
    );
    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await expect(
      transcribeAudio({ apiKey: "k", audio, filename: "rec.webm" }),
    ).rejects.toMatchObject({
      name: "TranscriptionError",
      reason: "provider_rate_limit",
    });
  });

  it("throws TranscriptionError with provider_error on 5xx", async () => {
    mockFetch(
      (async () => new Response("err", { status: 500 })) as typeof fetch,
    );
    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await expect(
      transcribeAudio({ apiKey: "k", audio, filename: "rec.webm" }),
    ).rejects.toMatchObject({ reason: "provider_error" });
  });

  it("throws TranscriptionError with timeout on AbortError", async () => {
    mockFetch((async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }) as typeof fetch);
    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await expect(
      transcribeAudio({ apiKey: "k", audio, filename: "rec.webm" }),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  it("aborts via the real timeout wiring and maps to timeout", async () => {
    // Exercise the actual setTimeout -> controller.abort() path rather
    // than throwing AbortError directly: resolve fetch only when its
    // AbortSignal fires, then advance fake timers past the timeout.
    mockFetch(((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }
      });
    }) as typeof fetch);

    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    const promise = transcribeAudio({
      apiKey: "k",
      audio,
      filename: "rec.webm",
      timeoutMs: 50,
    });
    // Attach the rejection expectation BEFORE advancing timers so the
    // rejection isn't briefly unhandled when the abort fires.
    const assertion = expect(promise).rejects.toMatchObject({
      reason: "timeout",
    });
    // Drive the internal timeout to fire the abort.
    await jest.advanceTimersByTimeAsync(51);
    await assertion;
  });

  it("throws TranscriptionError with network on a non-abort fetch throw", async () => {
    mockFetch((async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch);
    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await expect(
      transcribeAudio({ apiKey: "k", audio, filename: "rec.webm" }),
    ).rejects.toMatchObject({
      name: "TranscriptionError",
      reason: "network",
    });
  });

  it("throws when the provider returns malformed JSON", async () => {
    mockFetch((async () => jsonResponse({ noText: true })) as typeof fetch);
    const audio = new Blob([new Uint8Array([1])], { type: "audio/webm" });
    await expect(
      transcribeAudio({ apiKey: "k", audio, filename: "rec.webm" }),
    ).rejects.toBeInstanceOf(TranscriptionError);
  });
});
