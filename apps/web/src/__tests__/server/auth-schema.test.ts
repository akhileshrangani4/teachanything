import { describe, it, expect } from "@jest/globals";
import { getAuthTables } from "@better-auth/core/db";
import { getTableColumns } from "drizzle-orm";
import { user, session, account, verification } from "@teachanything/db/schema";

import { userAdditionalFields } from "@/server/auth/user-fields";

/**
 * Better Auth's Drizzle adapter validates our schema against the one it
 * expects, on every auth request, and throws `SchemaMismatchError` when a
 * column it declares is missing. The check is on by default
 * (`advanced.database.validateSchema`), the result is cached, and it is
 * rethrown for every later call, so one absent column takes down sign-in,
 * sign-up, session reads, the lot.
 *
 * That is exactly what happened in 1.34.13. The `better-auth` 1.6.14 to 1.7.5
 * bump introduced the check, our `account` table had never carried
 * `accessTokenExpiresAt`, `refreshTokenExpiresAt` or `scope` (OAuth columns we
 * do not use, since the app is email and password only), and 1.6 never looked.
 * Nobody could sign in and the release had to be rolled back.
 *
 * Nothing else would have caught it. The columns are unused by our code, so
 * types pass; the test suite has no database, so tests pass; the check only
 * runs against a live adapter, so the build passes. It fails in production, on
 * the first request, or not at all.
 *
 * This runs the same comparison with no database: Better Auth's expected
 * tables against the columns our Drizzle schema actually declares.
 */
describe("Better Auth schema expectations", () => {
  const drizzleTables = { user, session, account, verification };

  // What `config.ts` passes, narrowed to the options that change which columns
  // Better Auth expects.
  const authTables = getAuthTables({
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    user: { additionalFields: userAdditionalFields },
  } as Parameters<typeof getAuthTables>[0]);

  // The adapter matches on the Drizzle property key, not the database column
  // name, so `expiresAt` is what it looks for and `expires_at` is not.
  const columnsFor = (model: keyof typeof drizzleTables) =>
    new Set(Object.keys(getTableColumns(drizzleTables[model])));

  it("declares every column Better Auth expects on each auth table", () => {
    const missing: string[] = [];

    for (const table of Object.values(authTables)) {
      const model = table.modelName as keyof typeof drizzleTables;
      if (!(model in drizzleTables)) continue;

      const declared = columnsFor(model);

      for (const [name, field] of Object.entries(table.fields)) {
        const column = field.fieldName ?? name;
        if (!declared.has(column)) missing.push(`${model}.${column}`);
      }
    }

    // A failure here means an auth dependency bump changed what Better Auth
    // expects. Add the columns and a migration before shipping it.
    expect(missing).toEqual([]);
  });

  it("covers the four tables wired into the Drizzle adapter", () => {
    // Guards the loop above: if a model name drifts, the `continue` would skip
    // the table and the first test would pass without checking anything.
    const checked = Object.values(authTables)
      .map((table) => table.modelName)
      .filter((model) => model in drizzleTables);

    expect(checked.sort()).toEqual([
      "account",
      "session",
      "user",
      "verification",
    ]);
  });
});
