import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder for jsdom (needed by @react-email/render)
if (typeof globalThis.TextDecoder === "undefined") {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
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
