/** @jest-environment node */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const deleteWhere = jest.fn().mockResolvedValue(undefined);
const deleteFrom = jest.fn().mockReturnValue({ where: deleteWhere });
const insertValues = jest.fn().mockResolvedValue(undefined);
const insertInto = jest.fn().mockReturnValue({ values: insertValues });
const updateWhere = jest.fn().mockResolvedValue(undefined);
const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
const updateTable = jest.fn().mockReturnValue({ set: updateSet });
const transaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
  callback({
    delete: deleteFrom,
    insert: insertInto,
    update: updateTable,
  }),
);

jest.unstable_mockModule("@teachanything/db", () => ({
  db: { transaction },
}));

const { replaceFileIndex } =
  await import("@/server/file-processor/file-index-storage");

describe("replaceFileIndex", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    deleteWhere.mockResolvedValue(undefined);
    deleteFrom.mockReturnValue({ where: deleteWhere });
    insertValues.mockResolvedValue(undefined);
    insertInto.mockReturnValue({ values: insertValues });
    updateWhere.mockResolvedValue(undefined);
    updateSet.mockReturnValue({ where: updateWhere });
    updateTable.mockReturnValue({ set: updateSet });
    transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          delete: deleteFrom,
          insert: insertInto,
          update: updateTable,
        }),
    );
  });

  it("deletes, inserts, and completes inside one transaction", async () => {
    const metadata = { processingVersion: 3, chunkCount: 1 };
    await replaceFileIndex({
      fileId: "11111111-1111-4111-8111-111111111111",
      chunks: [
        {
          fileId: "11111111-1111-4111-8111-111111111111",
          chunkIndex: 0,
          content: "Visual text",
        },
      ],
      metadata,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteFrom).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith({
      processingStatus: "completed",
      metadata,
    });
    expect(deleteFrom.mock.invocationCallOrder[0]).toBeLessThan(
      insertInto.mock.invocationCallOrder[0]!,
    );
    expect(insertInto.mock.invocationCallOrder[0]).toBeLessThan(
      updateTable.mock.invocationCallOrder[0]!,
    );
  });

  it("does not mark the file complete when inserting replacement chunks fails", async () => {
    insertValues.mockRejectedValueOnce(new Error("insert failed"));
    await expect(
      replaceFileIndex({
        fileId: "11111111-1111-4111-8111-111111111111",
        chunks: [],
        metadata: { processingVersion: 3 },
      }),
    ).rejects.toThrow("insert failed");
    expect(updateTable).not.toHaveBeenCalled();
  });
});
