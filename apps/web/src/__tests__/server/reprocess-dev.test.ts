/**
 * @jest-environment node
 *
 * Development runs the reprocess inline because QStash cannot deliver to
 * localhost. The production publish path is pinned in reprocess.test.ts; this
 * pins the development gate.
 */
import { jest, describe, it, expect } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const mockProcessFile =
  jest.fn<() => Promise<{ success: boolean; chunkCount: number }>>();
const mockPublish = jest.fn<() => Promise<{ messageId: string }>>();

jest.unstable_mockModule("@/lib/env", () => ({
  env: { NODE_ENV: "development" },
}));
jest.unstable_mockModule("@/server/qstash", () => ({
  publishFileProcessingJob: mockPublish,
}));
jest.unstable_mockModule("@/server/file-processor", () => ({
  CURRENT_PROCESSING_VERSION: 3,
  processFile: mockProcessFile,
}));
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn<() => void>(),
  logError: jest.fn<() => void>(),
}));

const { maybeEnqueueReprocess } = await import("@/server/reprocess");

function inlineDb() {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => [{ fileId: "f1" }],
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [{ fileId: "f1", userId: "owner-1" }],
        }),
      }),
    }),
  } as never;
}

describe("maybeEnqueueReprocess in development", () => {
  it("processes inline instead of publishing to QStash", async () => {
    mockProcessFile.mockResolvedValue({ success: true, chunkCount: 4 });

    await maybeEnqueueReprocess(inlineDb(), "bot-1");
    // The inline call is fire-and-forget; let its promise settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockProcessFile).toHaveBeenCalledWith({
      fileId: "f1",
      targetProcessingVersion: 3,
    });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("logs but does not throw when the inline run fails", async () => {
    mockProcessFile.mockRejectedValue(new Error("extractor exploded"));

    await maybeEnqueueReprocess(inlineDb(), "bot-1");
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockProcessFile).toHaveBeenCalledTimes(1);
  });
});
