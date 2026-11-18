/**
 * @jest-environment node
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { mkdtemp, mkdir, writeFile, rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

type RemoveResult =
  { data: Array<{ name: string }>; error: null } | { data: null; error: Error };

/**
 * An in-memory stand-in for the "chatbot-files" bucket. `remove` reports only
 * the keys it actually deleted, as Supabase does; `failRemoveCall` makes the
 * nth remove call (1-based) fail, and `denyDeletes` makes remove succeed
 * without deleting anything, as it does for a key without delete rights.
 */
class FakeBucket {
  readonly objects = new Set<string>();
  removeCalls = 0;
  failRemoveCall: number | null = null;
  denyDeletes = false;

  readonly remove = jest.fn(async (paths: string[]): Promise<RemoveResult> => {
    this.removeCalls += 1;
    if (this.removeCalls === this.failRemoveCall) {
      return { data: null, error: new Error("Storage unavailable") };
    }
    if (this.denyDeletes) return { data: [], error: null };
    const removed = paths.filter((path) => this.objects.delete(path));
    return { data: removed.map((name) => ({ name })), error: null };
  });

  readonly exists = jest.fn(async (path: string) => ({
    data: this.objects.has(path),
    error: null,
  }));
}

let bucket = new FakeBucket();
let supabaseConfigured = true;

jest.unstable_mockModule("@/lib/env", () => ({
  isServiceAvailable: (service: string) =>
    service === "supabase-storage" && supabaseConfigured,
}));
jest.unstable_mockModule("@/server/supabase", () => ({
  createSupabaseClient: () => ({ storage: { from: () => bucket } }),
}));

// local-storage resolves its uploads directory from the working directory at
// import time; point it at a temp dir so local-mode tests touch real files
// without going near the checkout.
const workDir = await mkdtemp(join(tmpdir(), "storage-removal-"));
const uploadsDir = join(workDir, "uploads");
const realCwd = process.cwd;
process.cwd = () => workDir;
const { removeStoredFiles, chunk, STORAGE_REMOVE_BATCH_SIZE } =
  await import("@/server/storage-removal");
process.cwd = realCwd;

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

function paths(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `user-1/file-${i}`);
}

describe("chunk", () => {
  it("splits into groups of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("rejects a size that would never finish", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});

describe("removeStoredFiles with Supabase Storage", () => {
  beforeEach(() => {
    supabaseConfigured = true;
    bucket = new FakeBucket();
  });

  it("does nothing for an empty list", async () => {
    await removeStoredFiles([]);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("removes every object", async () => {
    const keys = paths(3);
    keys.forEach((key) => bucket.objects.add(key));
    await removeStoredFiles(keys);
    expect(bucket.remove).toHaveBeenCalledWith(keys);
    expect(bucket.objects.size).toBe(0);
    expect(bucket.exists).not.toHaveBeenCalled();
  });

  it("removes more than 1,000 objects in batches", async () => {
    const keys = paths(2 * STORAGE_REMOVE_BATCH_SIZE + 1);
    keys.forEach((key) => bucket.objects.add(key));

    await removeStoredFiles(keys);

    expect(STORAGE_REMOVE_BATCH_SIZE).toBe(1000);
    const batchSizes = bucket.remove.mock.calls.map(([batch]) => batch.length);
    expect(batchSizes).toEqual([1000, 1000, 1]);
    expect(bucket.remove.mock.calls.flatMap(([batch]) => batch)).toEqual(keys);
    expect(bucket.objects.size).toBe(0);
  });

  it("throws when Storage returns an error", async () => {
    bucket.objects.add("user-1/file-0");
    bucket.failRemoveCall = 1;
    await expect(removeStoredFiles(["user-1/file-0"])).rejects.toThrow(
      "Storage unavailable",
    );
  });

  it("treats an object that is already gone as removed", async () => {
    bucket.objects.add("user-1/file-0");
    await removeStoredFiles(["user-1/file-0", "user-1/already-gone"]);
    expect(bucket.exists).toHaveBeenCalledTimes(1);
    expect(bucket.exists).toHaveBeenCalledWith("user-1/already-gone");
  });

  it("throws when Storage reports success but the object is still there", async () => {
    bucket.objects.add("user-1/file-0");
    bucket.denyDeletes = true;
    await expect(removeStoredFiles(["user-1/file-0"])).rejects.toThrow(
      "Storage did not delete 1 of 1 unconfirmed files",
    );
  });

  it("stops at the first failed batch", async () => {
    const keys = paths(STORAGE_REMOVE_BATCH_SIZE * 2 + 1);
    keys.forEach((key) => bucket.objects.add(key));
    bucket.failRemoveCall = 2;

    await expect(removeStoredFiles(keys)).rejects.toThrow();
    expect(bucket.remove).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry after a partial removal", async () => {
    const keys = paths(STORAGE_REMOVE_BATCH_SIZE + 500);
    keys.forEach((key) => bucket.objects.add(key));
    bucket.failRemoveCall = 2;

    await expect(removeStoredFiles(keys)).rejects.toThrow();
    // The first batch is gone, the second is not.
    expect(bucket.objects.size).toBe(500);

    await removeStoredFiles(keys);
    expect(bucket.objects.size).toBe(0);
  });
});

describe("removeStoredFiles in local storage mode", () => {
  beforeEach(async () => {
    supabaseConfigured = false;
    bucket = new FakeBucket();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  async function storeLocally(key: string): Promise<string> {
    const file = join(uploadsDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, "contents");
    return file;
  }

  it("deletes the files from disk", async () => {
    const kept = await storeLocally("user-2/keep");
    const first = await storeLocally("user-1/file-0");
    const second = await storeLocally("user-1/file-1");

    await removeStoredFiles(["user-1/file-0", "user-1/file-1"]);

    expect(existsSync(first)).toBe(false);
    expect(existsSync(second)).toBe(false);
    expect(existsSync(kept)).toBe(true);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("treats a file that is already gone as removed", async () => {
    await storeLocally("user-1/file-0");
    await removeStoredFiles(["user-1/file-0", "user-1/never-existed"]);
    expect(await readdir(join(uploadsDir, "user-1"))).toEqual([]);
  });

  it("rejects a path that escapes the uploads directory", async () => {
    await expect(removeStoredFiles(["../outside"])).rejects.toThrow(
      "Invalid storage path",
    );
  });
});
