/**
 * Database Reset Script
 *
 * ⚠️  WARNING: This script will DELETE ALL DATA in your database!
 *
 * PURPOSE:
 *   Completely resets the database by dropping all tables and custom types.
 *   Useful for development when you want to start fresh.
 *
 * WHAT IT DOES:
 *   1. Drops all tables (in reverse dependency order to avoid foreign key errors)
 *   2. Drops all custom types (enums)
 *   3. Provides next steps for recreating the schema
 *
 * WHEN TO USE:
 *   - During development when you want to reset everything
 *   - When testing migrations from scratch
 *   - When you need to start with a clean slate
 *
 * ⚠️  DO NOT USE IN PRODUCTION!
 *    This will permanently delete all data. There is no undo!
 *
 * Usage:
 *   npm run db:reset
 *
 * After running:
 *   1. Run: npm run db:push (to recreate schema)
 *   OR
 *   2. Run: npm run db:migrate (to run migrations)
 *
 * Then:
 *   - Run: npm run db:setup-rls (to disable RLS on file tables)
 *   - Create admin user using create-admin.sql if needed
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from apps/web/.env
const envPath = resolve(__dirname, "../../../apps/web/.env");
const result = config({ path: envPath });

if (result.error) {
  console.error("❌ Error loading .env file:", result.error);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function resetDatabase() {
  const sql = postgres(databaseUrl!);

  try {
    console.log("🗑️  Resetting database...");
    console.log("⚠️  WARNING: This will delete ALL data!");

    // Drop all tables first (in reverse dependency order to avoid foreign key errors)
    const dropTablesSQL = `
      DROP TABLE IF EXISTS "messages" CASCADE;
      DROP TABLE IF EXISTS "conversations" CASCADE;
      DROP TABLE IF EXISTS "file_chunks" CASCADE;
      DROP TABLE IF EXISTS "chatbot_file_associations" CASCADE;
      DROP TABLE IF EXISTS "user_files" CASCADE;
      DROP TABLE IF EXISTS "analytics" CASCADE;
      DROP TABLE IF EXISTS "chatbots" CASCADE;
      DROP TABLE IF EXISTS "approved_domains" CASCADE;
      DROP TABLE IF EXISTS "account" CASCADE;
      DROP TABLE IF EXISTS "session" CASCADE;
      DROP TABLE IF EXISTS "verification" CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `;

    await sql.unsafe(dropTablesSQL);
    console.log("✅ Dropped all tables");

    // Drop all custom types (enums)
    const dropTypesSQL = `
      DROP TYPE IF EXISTS "processing_status" CASCADE;
      DROP TYPE IF EXISTS "user_role" CASCADE;
      DROP TYPE IF EXISTS "user_status" CASCADE;
    `;

    await sql.unsafe(dropTypesSQL);
    console.log("✅ Dropped all custom types");

    console.log("\n✅ Database reset complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. Run: npm run db:push (to recreate schema)");
    console.log("   OR");
    console.log("   2. Run: npm run db:migrate (to run migrations)");
    console.log(
      "\n   3. Then run: npm run db:setup-rls (to disable RLS on file tables)",
    );
    console.log("   4. Create admin user using create-admin.sql if needed");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetDatabase();
