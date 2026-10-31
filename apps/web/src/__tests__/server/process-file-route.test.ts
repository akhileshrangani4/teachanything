/**
 * @jest-environment node
 *
 * The file-processing job's runtime ceiling and its QStash boundary.
 *
 * maxDuration is asserted rather than assumed because nothing else in the
 * build catches its absence: a missing export is a silent revert to the
 * platform default, which killed long embeds mid-run. The handler tests pin
 * the payload contract, including the force flag that lets an explicit retry
 * reprocess a completed file.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextRequest } from "next/server";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const verifySignature = jest.fn<() => Promise<boolean>>();
const processFile =
  jest.fn<() => Promise<{ success: boolean; chunkCount: number }>>();
const qstashState: { receiver: unknown } = { receiver: {} };

jest.unstable_mockModule("@/server/qstash", () => ({
  qstashReceiver: qstashState.receiver,
  verifyQStashSignature: verifySignature,
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logError: jest.fn<() => void>(),
  logInfo: jest.fn<() => void>(),
  logWarn: jest.fn<() => void>(),
}));
jest.unstable_mockModule("@/server/file-processor", () => ({
  CURRENT_PROCESSING_VERSION: 3,
  processFile,
}));

const route = await import("@/app/api/jobs/process-file/route");

const FILE_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function request(body: string, signature?: string): NextRequest {
  const headers = new Headers();
  if (signature) headers.set("Upstash-Signature", signature);
  return {
    headers,
    text: async () => body,
    url: "http://localhost:3000/api/jobs/process-file",
  } as unknown as NextRequest;
}

beforeEach(() => {
  qstashState.receiver = {};
  processFile.mockResolvedValue({ success: true, chunkCount: 4 });
});

describe("POST /api/jobs/process-file", () => {
  it("declares the same 5-minute ceiling as the crawl jobs", () => {
    expect(route.maxDuration).toBe(300);
  });

  it("still exports a POST handler", () => {
    expect(typeof route.POST).toBe("function");
  });

  it("rejects a job with no QStash signature", async () => {
    const response = await route.POST(request("{}"));

    expect(response.status).toBe(401);
  });

  it("rejects a job whose signature does not verify", async () => {
    verifySignature.mockResolvedValue(false);

    const response = await route.POST(request("{}", "forged"));

    expect(response.status).toBe(401);
    expect(processFile).not.toHaveBeenCalled();
  });

  it("processes the job, forwarding force and the current version", async () => {
    verifySignature.mockResolvedValue(true);
    processFile.mockResolvedValue({ success: true, chunkCount: 9 });

    const response = await route.POST(
      request(JSON.stringify({ fileId: FILE_ID, force: true }), "sig"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      fileId: FILE_ID,
      chunkCount: 9,
    });
    expect(processFile).toHaveBeenCalledWith({
      fileId: FILE_ID,
      targetProcessingVersion: 3,
      force: true,
    });
  });

  it("rejects a malformed payload with 400", async () => {
    verifySignature.mockResolvedValue(true);

    const response = await route.POST(
      request(JSON.stringify({ fileId: "not-a-uuid" }), "sig"),
    );

    expect(response.status).toBe(400);
    expect(processFile).not.toHaveBeenCalled();
  });

  it("returns a generic 500 without echoing the error", async () => {
    verifySignature.mockResolvedValue(true);

    const response = await route.POST(request("{not json", "sig"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal processing error",
    });
  });
});
