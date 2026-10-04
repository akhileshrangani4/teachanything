/**
 * @jest-environment node
 *
 * finalizeUpload's database step runs after the file is already in Storage,
 * so a transient failure there used to cost the user a full re-upload. These
 * pin down the retry, and above all that retrying never turns a stalled
 * attempt that did commit into a "name already taken" error.
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { TRPCError } from "@trpc/server";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const mockLogWarn = jest.fn();
jest.unstable_mockModule("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: mockLogWarn,
}));

const { createFileRecord } =
  await import("@/server/routers/files/procedures/create-file-record");

const file = {
  id: "6f1c1d8e-2b4a-4c1e-9a43-0f2d6c9b7a11",
  userId: "user-1",
  fileName: "notes.pdf",
  fileType: "application/pdf",
  fileSize: 1000,
  storagePath: "user-1/6f1c1d8e-2b4a-4c1e-9a43-0f2d6c9b7a11",
};
const row = { ...file, processingStatus: "pending" };

/** No waiting between attempts, and a short leash on a stalled one. */
const fast = { retryDelaysMs: [0, 0], attemptTimeoutMs: 50 };

type Step = () => Promise<unknown[]>;

/**
 * A db that answers each select and insert from its own script, in call order.
 * A step that is missing resolves to no rows.
 */
function scriptedDb(script: { selects?: Step[]; inserts?: Step[] }) {
  const selects = [...(script.selects ?? [])];
  const inserts = [...(script.inserts ?? [])];
  const next = (steps: Step[]) => (steps.shift() ?? (async () => []))();
  const insert = jest.fn(() => ({
    values: () => ({
      onConflictDoNothing: () => ({ returning: () => next(inserts) }),
    }),
  }));
  const db = {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => next(selects) }) }),
    }),
    insert,
  };
  return { db: db as never, insert };
}

const none: Step = async () => [];
const rows =
  (...r: unknown[]): Step =>
  async () =>
    r;
const fails =
  (message: string): Step =>
  async () => {
    throw new Error(message);
  };
const hangs: Step = () => new Promise(() => {});

beforeEach(() => mockLogWarn.mockReset());

describe("createFileRecord", () => {
  it("inserts the row on the first attempt", async () => {
    const { db, insert } = scriptedDb({ inserts: [rows(row)] });

    await expect(createFileRecord(db, file, fast)).resolves.toEqual(row);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it("retries after a failed attempt and succeeds", async () => {
    const { db, insert } = scriptedDb({
      inserts: [fails("connection lost"), rows(row)],
    });

    await expect(createFileRecord(db, file, fast)).resolves.toEqual(row);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(mockLogWarn).toHaveBeenCalledTimes(1);
  });

  it("gives up a stalled attempt and retries on a fresh one", async () => {
    const { db } = scriptedDb({ selects: [hangs], inserts: [rows(row)] });

    await expect(createFileRecord(db, file, fast)).resolves.toEqual(row);
  });

  it("returns the row a timed-out attempt committed instead of calling it a duplicate", async () => {
    // Attempt 1 stalls on its insert; by attempt 2 that insert has committed,
    // so the file's own row is there. Its name now matches too, and must not
    // be read as someone else's file.
    const { db, insert } = scriptedDb({
      selects: [none, none, rows(row)],
      inserts: [hangs],
    });

    await expect(createFileRecord(db, file, fast)).resolves.toEqual(row);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("returns the row when an earlier attempt commits between lookup and insert", async () => {
    // Own-row lookup and duplicate check find nothing, the insert hits the id
    // conflict, and the second lookup finds the row that just landed.
    const { db } = scriptedDb({
      selects: [none, none, rows(row)],
      inserts: [none],
    });

    await expect(createFileRecord(db, file, fast)).resolves.toEqual(row);
  });

  it("rejects a name that another file already uses, without retrying", async () => {
    const { db, insert } = scriptedDb({
      selects: [none, rows({ id: "someone-else" })],
    });

    await expect(createFileRecord(db, file, fast)).rejects.toBeInstanceOf(
      TRPCError,
    );
    expect(insert).not.toHaveBeenCalled();
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it("throws the last error once every attempt has failed", async () => {
    const { db, insert } = scriptedDb({
      inserts: [fails("one"), fails("two"), fails("three")],
    });

    await expect(createFileRecord(db, file, fast)).rejects.toThrow("three");
    expect(insert).toHaveBeenCalledTimes(3);
  });
});
