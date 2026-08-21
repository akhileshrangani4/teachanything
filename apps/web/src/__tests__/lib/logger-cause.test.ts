import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

process.env.ENABLE_LOGGING = "true";

const { logError } = await import("@teachanything/logger");

/**
 * The failure that motivated this: a retry died on
 * `Failed query: delete from "file_chunks" where ...` and the log carried only
 * that line. drizzle keeps the Postgres error -- the part naming what actually
 * went wrong -- in `cause`, and `logError` was dropping it, so the logs said a
 * statement failed without ever saying why.
 */
type LoggedCause = {
  message: string;
  name?: string;
  code?: string;
  severity?: string;
  routine?: string;
};
type LoggedPayload = {
  error: { message: string; name?: string; causes?: LoggedCause[] };
};

describe("logError cause unwrapping", () => {
  let spy: ReturnType<typeof jest.spyOn>;
  const logged = () => spy.mock.calls[0]?.[1] as unknown as LoggedPayload;

  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("surfaces the postgres error a drizzle wrapper hides", () => {
    const pgError = Object.assign(new Error('relation "x" does not exist'), {
      code: "42P01",
      severity: "ERROR",
      routine: "parserOpenTable",
    });
    const wrapped = new Error('Failed query: delete from "file_chunks" ...', {
      cause: pgError,
    });

    logError(wrapped, "File retry failed", { fileId: "abc" });

    const { error } = logged();
    expect(error.message).toContain("Failed query");
    expect(error.causes).toHaveLength(1);
    expect(error.causes?.[0]).toMatchObject({
      message: 'relation "x" does not exist',
      code: "42P01",
      severity: "ERROR",
      routine: "parserOpenTable",
    });
  });

  it("walks a nested chain", () => {
    const root = Object.assign(new Error("connection terminated"), {
      code: "08006",
    });
    const mid = new Error("driver failed", { cause: root });
    logError(new Error("query failed", { cause: mid }), "boom");

    expect(logged().error.causes?.map((c) => c.message)).toEqual([
      "driver failed",
      "connection terminated",
    ]);
  });

  it("omits the field entirely when there is no cause", () => {
    logError(new Error("plain"), "boom");
    expect(logged().error).not.toHaveProperty("causes");
  });

  it("does not hang on a self-referential chain", () => {
    const a: Error & { cause?: unknown } = new Error("a");
    const b: Error & { cause?: unknown } = new Error("b");
    a.cause = b;
    b.cause = a;

    expect(() => logError(a, "boom")).not.toThrow();
    expect(logged().error.causes?.length ?? 0).toBeLessThanOrEqual(5);
  });

  it("still unwraps when the thrown value is a plain object", () => {
    logError(
      { message: "wrapped", cause: { message: "inner", code: "22P02" } },
      "boom",
    );
    expect(logged().error.causes?.[0]).toMatchObject({
      message: "inner",
      code: "22P02",
    });
  });
});
