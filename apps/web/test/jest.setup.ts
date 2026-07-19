import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import { TextEncoder, TextDecoder } from "util";
import { TransformStream, ReadableStream, WritableStream } from "stream/web";

// Polyfill TextEncoder/TextDecoder for jsdom (needed by @react-email/render)
if (typeof globalThis.TextDecoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

// Polyfill Web Streams for jsdom (needed by the `ai` SDK, which references
// TransformStream at module load). Node's `node` test environment provides
// these globally; jsdom does not.
if (typeof globalThis.TransformStream === "undefined") {
  Object.assign(globalThis, {
    TransformStream,
    ReadableStream,
    WritableStream,
  });
}

// jsdom-only polyfills (skipped when running with @jest-environment node)
if (typeof window !== "undefined") {
  // Polyfill ResizeObserver for jsdom
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Polyfill scrollIntoView for jsdom
  Element.prototype.scrollIntoView = jest.fn<Element["scrollIntoView"]>();

  // Mock navigator.clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      readText: jest.fn<() => Promise<string>>().mockResolvedValue(""),
    },
  });
}
