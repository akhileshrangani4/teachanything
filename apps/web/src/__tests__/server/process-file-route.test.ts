/**
 * @jest-environment node
 *
 * The file-processing job's runtime ceiling.
 *
 * Embedding is the slowest stage of the pipeline, and this route ran on the
 * platform default until it was set here -- so any file needing more than a
 * couple of embedding batches was killed mid-run and showed the owner a file
 * stuck at 40% before failing. The value is asserted rather than assumed
 * because nothing else in the build catches its absence: a missing export is a
 * silent revert to the default.
 */
import { jest, describe, it, expect } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

// Every boundary the module pulls in at import time. Nothing here is exercised;
// the point is to be able to import the route at all.
jest.unstable_mockModule("@/lib/qstash", () => ({
  qstashReceiver: null,
  verifyQStashSignature: jest.fn(),
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));
jest.unstable_mockModule("@/lib/file-processor", () => ({
  processFile: jest.fn(),
}));

const route = await import("@/app/api/jobs/process-file/route");

describe("POST /api/jobs/process-file", () => {
  it("declares the same 5-minute ceiling as the crawl jobs", () => {
    expect(route.maxDuration).toBe(300);
  });

  it("still exports a POST handler", () => {
    expect(typeof route.POST).toBe("function");
  });
});
