/**
 * Database Seed Script
 *
 * Creates comprehensive demo data for local development:
 * - Admin user (from ADMIN_EMAILS)
 * - Demo professor with 3 chatbots and files in every supported format
 * - Pending user (to test admin approval workflow)
 * - Demo conversations, messages, and analytics
 *
 * Files are read from packages/db/scripts/fixtures/ (all 6 supported formats).
 *
 * Usage:
 *   npm run db:seed
 *
 * Credentials:
 *   Admin:     first entry from ADMIN_EMAILS / admin123
 *   Professor: professor@demo.edu / demo123
 *   Student:   student@demo.edu / demo123 (pending approval)
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile, mkdir, copyFile } from "fs/promises";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, "../../../apps/web/.env");
config({ path: envPath });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adminEmails = process.env.ADMIN_EMAILS;
if (!adminEmails) {
  console.error("ADMIN_EMAILS is not set");
  process.exit(1);
}

const openaiApiKey = process.env.OPENAI_API_KEY;
const fixturesDir = resolve(__dirname, "fixtures");
const uploadsDir = resolve(__dirname, "../../../apps/web/uploads");

// =============================================================================
// Fixture file definitions — maps to every supported MIME type
// =============================================================================

interface FixtureFile {
  /** Display name in the app */
  name: string;
  /** MIME type */
  mime: string;
  /** Filename inside fixtures/ */
  fixture: string;
  /** Which chatbot this file belongs to (index into chatbot array) */
  chatbotIndex: number;
}

const FIXTURES: FixtureFile[] = [
  {
    name: "CS101 - Introduction to Programming.txt",
    mime: "text/plain",
    fixture: "cs101-notes.txt",
    chatbotIndex: 0,
  },
  {
    name: "CS101 - Course Syllabus.json",
    mime: "application/json",
    fixture: "cs101-syllabus.json",
    chatbotIndex: 0,
  },
  {
    name: "MATH201 - Linear Algebra Notes.md",
    mime: "text/markdown",
    fixture: "math201-notes.md",
    chatbotIndex: 1,
  },
  {
    name: "MATH201 - Student Grades.csv",
    mime: "text/csv",
    fixture: "math201-grades.csv",
    chatbotIndex: 1,
  },
  {
    name: "PHYS101 - Lecture Notes.pdf",
    mime: "application/pdf",
    fixture: "phys101-lecture.pdf",
    chatbotIndex: 2,
  },
  {
    name: "PHYS101 - Lab Manual.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fixture: "phys101-lab-manual.docx",
    chatbotIndex: 2,
  },
];

// =============================================================================
// Helpers
// =============================================================================

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openaiApiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return json.data[0]!.embedding;
  } catch {
    return null;
  }
}

function chunkText(content: string): string[] {
  const chunkSize = 2500;
  const overlap = 250;
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = start + chunkSize;
    if (end < content.length) {
      const boundary = content.lastIndexOf("\n\n", end);
      if (boundary > start + chunkSize / 2) end = boundary;
    }
    chunks.push(content.slice(start, end).trim());
    start = end - overlap;
  }
  return chunks.filter((c) => c.length > 0);
}

/** Extract text from a fixture file for chunking. Binary formats use extractors. */
async function extractText(buf: Buffer, mime: string): Promise<string> {
  switch (mime) {
    case "application/pdf": {
      // Import lib directly to avoid pdf-parse's index.js loading a test file on import
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const data = await pdfParse(buf);
      return data.text;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/msword": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value;
    }
    default:
      return buf.toString("utf-8");
  }
}

function formatVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// =============================================================================
// Seed
// =============================================================================

async function seed() {
  const sql = postgres(databaseUrl!);

  try {
    const existing =
      await sql`SELECT id FROM "user" WHERE email = 'professor@demo.edu'`;
    if (existing.length > 0) {
      console.log("Demo data already exists, skipping seed.");
      console.log("To re-seed, drop your database and run db:push + db:seed");
      return;
    }

    console.log("Seeding database...\n");

    const adminPwHash = await bcrypt.hash("admin123", 12);
    const demoPwHash = await bcrypt.hash("demo123", 12);

    await sql.begin(async (tx) => {
      // =================================================================
      // 1. Users
      // =================================================================
      const adminEmail = adminEmails!.split(",")[0]!.trim();
      const existingAdmin =
        await tx`SELECT id FROM "user" WHERE email = ${adminEmail}`;

      if (existingAdmin.length > 0) {
        console.log(`  Admin already exists (${adminEmail})`);
      } else {
        const [admin] = await tx`
          INSERT INTO "user" (id, email, name, email_verified, status, role, created_at, updated_at)
          VALUES (gen_random_uuid()::text, ${adminEmail}, 'Admin', true, 'approved', 'admin', NOW(), NOW())
          RETURNING id`;
        await tx`
          INSERT INTO "account" (id, user_id, account_id, provider_id, password, created_at, updated_at)
          VALUES (gen_random_uuid()::text, ${admin!.id}, ${adminEmail}, 'credential', ${adminPwHash}, NOW(), NOW())`;
        console.log(`  Admin: ${adminEmail} / admin123`);
      }

      const [professor] = await tx`
        INSERT INTO "user" (id, email, name, email_verified, status, role, title, department, institutional_affiliation, created_at, updated_at)
        VALUES (gen_random_uuid()::text, 'professor@demo.edu', 'Dr. Jane Smith', true, 'approved', 'user', 'Professor', 'Computer Science', 'Demo University', NOW(), NOW())
        RETURNING id`;
      const profId = professor!.id;
      await tx`
        INSERT INTO "account" (id, user_id, account_id, provider_id, password, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${profId}, 'professor@demo.edu', 'credential', ${demoPwHash}, NOW(), NOW())`;
      console.log("  Professor: professor@demo.edu / demo123");

      const [pending] = await tx`
        INSERT INTO "user" (id, email, name, email_verified, status, role, department, institutional_affiliation, created_at, updated_at)
        VALUES (gen_random_uuid()::text, 'student@demo.edu', 'Alex Johnson', true, 'pending', 'user', 'Mathematics', 'Demo University', NOW(), NOW())
        RETURNING id`;
      await tx`
        INSERT INTO "account" (id, user_id, account_id, provider_id, password, created_at, updated_at)
        VALUES (gen_random_uuid()::text, ${pending!.id}, 'student@demo.edu', 'credential', ${demoPwHash}, NOW(), NOW())`;
      console.log("  Pending: student@demo.edu / demo123\n");

      // =================================================================
      // 2. Chatbots
      // =================================================================
      const chatbotDefs = [
        {
          name: "Introduction to Computer Science",
          desc: "AI assistant for CS101. Ask about programming, data structures, and algorithms.",
          prompt:
            "You are a helpful CS teaching assistant for CS101. Answer clearly with examples. Encourage learning and give step-by-step explanations.",
          welcome:
            "Welcome to CS101! Ask me about programming concepts, data structures, or algorithms.",
          questions: [
            "What are the basic data types?",
            "Explain how a for loop works",
            "What is the difference between a stack and a queue?",
          ],
        },
        {
          name: "Linear Algebra",
          desc: "AI assistant for MATH201. Ask about vectors, matrices, and linear transformations.",
          prompt:
            "You are a math teaching assistant for MATH201: Linear Algebra. Explain concepts clearly with notation and examples. Break problems into smaller parts.",
          welcome:
            "Welcome to Linear Algebra! I can help with vectors, matrices, eigenvalues, and more.",
          questions: [
            "How do I multiply two matrices?",
            "What are eigenvalues and why do they matter?",
            "Explain the rank-nullity theorem",
          ],
        },
        {
          name: "Introduction to Physics",
          desc: "AI assistant for PHYS101. Ask about mechanics, energy, waves, and thermodynamics.",
          prompt:
            "You are a physics teaching assistant for PHYS101. Explain concepts with real-world examples. Use equations when appropriate and walk through problems step by step.",
          welcome:
            "Welcome to PHYS101! Ask me about mechanics, energy, waves, or thermodynamics.",
          questions: [
            "Explain Newton's three laws of motion",
            "What is the conservation of energy?",
            "How do standing waves work?",
          ],
        },
      ];

      const chatbotIds: string[] = [];
      for (const bot of chatbotDefs) {
        const [row] = await tx`
          INSERT INTO "chatbots" (id, user_id, name, description, system_prompt, model, temperature, max_tokens, welcome_message, suggested_questions, sharing_enabled, show_sources, created_at, updated_at)
          VALUES (gen_random_uuid(), ${profId}, ${bot.name}, ${bot.desc}, ${bot.prompt},
            'meta-llama/llama-3.3-70b-instruct', 70, 2000, ${bot.welcome},
            ${JSON.stringify(bot.questions)}::jsonb, true, true, NOW(), NOW())
          RETURNING id`;
        chatbotIds.push(row!.id);
      }
      console.log("  Chatbots: CS101, MATH201, PHYS101");

      // =================================================================
      // 3. Files — read from fixtures/, copy to local storage
      // =================================================================
      await mkdir(resolve(uploadsDir, profId), { recursive: true });

      const fileIds: string[] = [];
      for (const f of FIXTURES) {
        const fixturePath = resolve(fixturesDir, f.fixture);
        const storagePath = `${profId}/${f.fixture}`;
        const destPath = resolve(uploadsDir, storagePath);

        // Copy fixture to local storage
        await copyFile(fixturePath, destPath);

        // Read file content for chunking
        const buf = await readFile(fixturePath);
        const textContent = await extractText(buf, f.mime);
        const chunks = chunkText(textContent);

        // Insert file record
        const [row] = await tx`
          INSERT INTO "user_files" (id, user_id, file_name, file_type, file_size, storage_path, processing_status, metadata, created_at)
          VALUES (gen_random_uuid(), ${profId}, ${f.name}, ${f.mime}, ${buf.length}, ${storagePath}, 'completed',
            ${JSON.stringify({ chunkCount: chunks.length, processedAt: new Date().toISOString() })}::jsonb, NOW())
          RETURNING id`;
        fileIds.push(row!.id);

        // Associate with chatbot
        await tx`
          INSERT INTO "chatbot_file_associations" (id, chatbot_id, file_id, created_at)
          VALUES (gen_random_uuid(), ${chatbotIds[f.chatbotIndex]!}, ${row!.id}, NOW())`;
      }
      console.log("  Files: .txt .json .md .csv .pdf .docx (6 formats)");

      // =================================================================
      // 4. Chunks + Embeddings
      // =================================================================
      console.log("\n  Generating chunks...");
      if (openaiApiKey) {
        console.log("  OpenAI key found — generating embeddings...");
      } else {
        console.log(
          "  No OPENAI_API_KEY — chunks saved without embeddings (RAG search will not work)",
        );
      }

      for (let fi = 0; fi < FIXTURES.length; fi++) {
        const f = FIXTURES[fi]!;
        const buf = await readFile(resolve(fixturesDir, f.fixture));
        const text = await extractText(buf, f.mime);
        const chunks = chunkText(text);

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i]!);
          if (embedding) {
            await tx`
              INSERT INTO "file_chunks" (id, file_id, chunk_index, content, embedding, token_count, metadata, created_at)
              VALUES (gen_random_uuid(), ${fileIds[fi]!}, ${i}, ${chunks[i]!}, ${formatVector(embedding)}::vector, ${Math.ceil(chunks[i]!.length / 4)}, '{}'::jsonb, NOW())`;
          } else {
            await tx`
              INSERT INTO "file_chunks" (id, file_id, chunk_index, content, token_count, metadata, created_at)
              VALUES (gen_random_uuid(), ${fileIds[fi]!}, ${i}, ${chunks[i]!}, ${Math.ceil(chunks[i]!.length / 4)}, '{}'::jsonb, NOW())`;
          }
        }
        console.log(`    ${f.fixture} — ${chunks.length} chunks`);
      }

      // =================================================================
      // 5. Demo conversations
      // =================================================================
      const sessions = [
        `demo-cs-${Date.now()}`,
        `demo-math-${Date.now() + 1}`,
        `demo-phys-${Date.now() + 2}`,
      ];

      // CS conversation
      const [csConv] = await tx`
        INSERT INTO "conversations" (id, chatbot_id, session_id, metadata, created_at, updated_at)
        VALUES (gen_random_uuid(), ${chatbotIds[0]!}, ${sessions[0]!}, '{}'::jsonb, NOW(), NOW())
        RETURNING id`;
      await tx`
        INSERT INTO "messages" (id, conversation_id, role, content, metadata, created_at) VALUES
        (gen_random_uuid(), ${csConv!.id}, 'user', 'What is a variable in programming?', '{}'::jsonb, NOW()),
        (gen_random_uuid(), ${csConv!.id}, 'assistant',
          'A variable is a named storage location in memory that holds a value. Think of it like a labeled box.

Common types:
- **Integers** — whole numbers (1, 42, -7)
- **Strings** — text ("Hello, World!")
- **Booleans** — true/false
- **Floats** — decimal numbers (3.14)

In Python: name = "Alice" creates a string variable.',
          ${JSON.stringify({ sources: [{ fileName: "CS101 - Introduction to Programming.txt", chunkIndex: 1, similarity: 0.89 }], responseTime: 1200, model: "meta-llama/llama-3.3-70b-instruct" })}::jsonb, NOW())`;

      // Math conversation
      const [mathConv] = await tx`
        INSERT INTO "conversations" (id, chatbot_id, session_id, metadata, created_at, updated_at)
        VALUES (gen_random_uuid(), ${chatbotIds[1]!}, ${sessions[1]!}, '{}'::jsonb, NOW(), NOW())
        RETURNING id`;
      await tx`
        INSERT INTO "messages" (id, conversation_id, role, content, metadata, created_at) VALUES
        (gen_random_uuid(), ${mathConv!.id}, 'user', 'How do I multiply two matrices?', '{}'::jsonb, NOW()),
        (gen_random_uuid(), ${mathConv!.id}, 'assistant',
          'To multiply A (m x n) by B (n x p), the element at (i,j) is the dot product of row i of A and column j of B.

Example: A = [[1,2],[3,4]], B = [[5,6],[7,8]]
C = [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]] = [[19,22],[43,50]]

Note: Matrix multiplication is NOT commutative — AB != BA in general.',
          ${JSON.stringify({ sources: [{ fileName: "MATH201 - Linear Algebra Notes.md", chunkIndex: 1, similarity: 0.91 }], responseTime: 1300, model: "meta-llama/llama-3.3-70b-instruct" })}::jsonb, NOW())`;

      // Physics conversation
      const [physConv] = await tx`
        INSERT INTO "conversations" (id, chatbot_id, session_id, metadata, created_at, updated_at)
        VALUES (gen_random_uuid(), ${chatbotIds[2]!}, ${sessions[2]!}, '{}'::jsonb, NOW(), NOW())
        RETURNING id`;
      await tx`
        INSERT INTO "messages" (id, conversation_id, role, content, metadata, created_at) VALUES
        (gen_random_uuid(), ${physConv!.id}, 'user', 'Explain Newton''s three laws of motion', '{}'::jsonb, NOW()),
        (gen_random_uuid(), ${physConv!.id}, 'assistant',
          '**First Law (Inertia):** An object stays at rest or in motion unless acted on by an external force.

**Second Law (F = ma):** Acceleration is proportional to net force and inversely proportional to mass.

**Third Law (Action-Reaction):** For every action there is an equal and opposite reaction.',
          ${JSON.stringify({ sources: [{ fileName: "PHYS101 - Lecture Notes.pdf", chunkIndex: 0, similarity: 0.93 }], responseTime: 1100, model: "meta-llama/llama-3.3-70b-instruct" })}::jsonb, NOW())`;

      console.log("\n  Conversations: 3 (one per chatbot)");

      // =================================================================
      // 6. Analytics
      // =================================================================
      await tx`
        INSERT INTO "analytics" (id, chatbot_id, event_type, event_data, session_id, created_at) VALUES
        (gen_random_uuid(), ${chatbotIds[0]!}, 'session_start', '{}'::jsonb, ${sessions[0]!}, NOW() - interval '3 hours'),
        (gen_random_uuid(), ${chatbotIds[0]!}, 'message_sent', ${JSON.stringify({ messageLength: 40, responseLength: 450, responseTime: 1200, ragUsed: true })}::jsonb, ${sessions[0]!}, NOW() - interval '3 hours'),
        (gen_random_uuid(), ${chatbotIds[1]!}, 'session_start', '{}'::jsonb, ${sessions[1]!}, NOW() - interval '2 hours'),
        (gen_random_uuid(), ${chatbotIds[1]!}, 'message_sent', ${JSON.stringify({ messageLength: 35, responseLength: 500, responseTime: 1300, ragUsed: true })}::jsonb, ${sessions[1]!}, NOW() - interval '2 hours'),
        (gen_random_uuid(), ${chatbotIds[2]!}, 'session_start', '{}'::jsonb, ${sessions[2]!}, NOW() - interval '1 hour'),
        (gen_random_uuid(), ${chatbotIds[2]!}, 'message_sent', ${JSON.stringify({ messageLength: 42, responseLength: 280, responseTime: 1100, ragUsed: true })}::jsonb, ${sessions[2]!}, NOW() - interval '1 hour')`;
      console.log("  Analytics: 6 events");
    });

    // Summary
    const adminEmail = adminEmails!.split(",")[0]!.trim();
    console.log("\n" + "=".repeat(58));
    console.log("Seed complete!\n");
    console.log(`  Admin:     ${adminEmail} / admin123`);
    console.log("  Professor: professor@demo.edu / demo123");
    console.log("             3 chatbots, 6 files (all formats), RAG data");
    console.log("  Student:   student@demo.edu / demo123 (pending approval)");
    console.log("\n" + "=".repeat(58));
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
