import "@testing-library/jest-dom";
import { jest } from "@jest/globals";

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
