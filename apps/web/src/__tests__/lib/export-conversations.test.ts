import { describe, it, expect } from "@jest/globals";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import {
  buildCsv,
  buildText,
  buildHtml,
  buildInstructions,
  buildExportFiles,
  type ConversationsExport,
} from "@/lib/export-conversations";

function makeExport(
  overrides: Partial<ConversationsExport> = {},
): ConversationsExport {
  return {
    chatbotName: "Critical Theory",
    exportedAt: "2026-07-14T12:00:00.000Z",
    truncated: false,
    maxConversations: 1000,
    conversations: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        sessionId: "session-abc",
        createdAt: "2026-07-10T10:00:00.000Z",
        messages: [
          {
            role: "user",
            content: 'What is "hegemony", and why, no really?',
            createdAt: "2026-07-10T10:00:01.000Z",
            sources: [],
          },
          {
            role: "assistant",
            content: "Hegemony refers to dominance.\nSecond line here.",
            createdAt: "2026-07-10T10:00:05.000Z",
            sources: [{ fileName: "gramsci.pdf", similarity: 0.912 }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("buildCsv", () => {
  it("emits a header plus one row per message with a BOM", () => {
    const csv = buildCsv(makeExport());
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toContain("conversation_id");
    expect(lines[0]).toContain("message");
    // header + 2 messages
    expect(lines).toHaveLength(3);
  });

  it("labels roles as Student / Assistant", () => {
    const csv = buildCsv(makeExport());
    expect(csv).toContain('"Student"');
    expect(csv).toContain('"Assistant"');
  });

  it("escapes quotes and keeps commas/newlines inside one cell", () => {
    const csv = buildCsv(makeExport());
    // Internal double-quotes are doubled.
    expect(csv).toContain('""hegemony""');
    // The newline inside the assistant message is preserved within the quoted
    // cell, so splitting on CRLF still yields exactly 3 lines (tested above),
    // and the raw newline survives.
    expect(csv).toContain("Hegemony refers to dominance.\nSecond line here.");
  });

  it("includes source filename and similarity percentage", () => {
    const csv = buildCsv(makeExport());
    expect(csv).toContain("gramsci.pdf (91.2%)");
  });

  it("neutralizes spreadsheet formula injection with a leading apostrophe", () => {
    const csv = buildCsv(
      makeExport({
        conversations: [
          {
            id: "c1",
            sessionId: "s1",
            createdAt: "2026-07-10T10:00:00.000Z",
            messages: [
              {
                role: "user",
                content: "=SUM(A1:A9)+cmd|' /C calc'!A0",
                createdAt: "2026-07-10T10:00:01.000Z",
                sources: [],
              },
            ],
          },
        ],
      }),
    );
    // The formula-looking cell is prefixed so Excel/Sheets treat it as text.
    expect(csv).toContain(`"'=SUM(A1:A9)+cmd|' /C calc'!A0"`);
  });
});

describe("buildText", () => {
  it("groups by conversation and labels turns", () => {
    const text = buildText(makeExport());
    expect(text).toContain("Chat Records: Critical Theory");
    expect(text).toContain("=== Conversation 1 of 1 ===");
    expect(text).toContain("[1] Student:");
    expect(text).toContain("[2] Assistant:");
    expect(text).toContain("gramsci.pdf (91.2%)");
  });

  it("handles an empty export", () => {
    const text = buildText(makeExport({ conversations: [] }));
    expect(text).toContain("No chat records to export.");
  });
});

describe("buildHtml", () => {
  it("escapes HTML in message content and chatbot name", () => {
    const html = buildHtml(
      makeExport({
        chatbotName: "Theory <script>",
        conversations: [
          {
            id: "c1",
            sessionId: "s1",
            createdAt: "2026-07-10T10:00:00.000Z",
            messages: [
              {
                role: "user",
                content: "<img src=x onerror=alert(1)>",
                createdAt: "2026-07-10T10:00:01.000Z",
                sources: [],
              },
            ],
          },
        ],
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("Theory &lt;script&gt;");
  });

  it("shows a truncation notice when the export was capped", () => {
    const html = buildHtml(
      makeExport({ truncated: true, maxConversations: 5 }),
    );
    expect(html).toContain("first 5 conversations");
  });
});

describe("buildInstructions", () => {
  it("documents only the chosen formats", () => {
    const instructions = buildInstructions(makeExport(), ["html", "text"]);
    expect(instructions).toContain("chat-records.html");
    expect(instructions).toContain("chat-records.txt");
    expect(instructions).not.toContain("chat-records.csv");
  });

  it("notes truncation when the export was capped", () => {
    const instructions = buildInstructions(
      makeExport({ truncated: true, maxConversations: 250 }),
      ["csv"],
    );
    expect(instructions).toContain("capped at the first 250 conversations");
  });
});

describe("study tools surface in every format", () => {
  function withQuiz(): ConversationsExport {
    return makeExport({
      conversations: [
        {
          id: "c1",
          sessionId: "s1",
          createdAt: "2026-07-10T10:00:00.000Z",
          messages: [
            {
              role: "user",
              content: "quiz me on cells",
              createdAt: "2026-07-10T10:00:01.000Z",
              sources: [],
            },
            {
              // Quiz-only assistant turn: empty prose, quiz in studyTools.
              role: "assistant",
              content: "",
              createdAt: "2026-07-10T10:00:05.000Z",
              sources: [],
              studyTools: [
                {
                  toolName: "showQuiz",
                  input: {
                    quiz_title: "Cell Biology",
                    questions: [
                      {
                        question: "Powerhouse of the cell?",
                        options: ["Nucleus", "Mitochondria"],
                        correct_index: 1,
                        explanation: "Mitochondria make ATP.",
                      },
                    ],
                  },
                  responses: [
                    {
                      attempt: 1,
                      response: { answers: [1], score: 1, total: 1 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  }

  it("includes the quiz in the text export", () => {
    const text = buildText(withQuiz());
    expect(text).toContain("Quiz: Cell Biology");
    expect(text).toContain("Mitochondria  [correct]");
    expect(text).toContain("Attempt 1 — score 1/1");
  });

  it("includes the quiz in the CSV study_tools column", () => {
    const csv = buildCsv(withQuiz());
    expect(csv.replace("\uFEFF", "").split("\r\n")[0]).toContain("study_tools");
    expect(csv).toContain("Quiz: Cell Biology");
  });

  it("renders the quiz block in the HTML export", () => {
    const html = buildHtml(withQuiz());
    expect(html).toContain("Quiz: Cell Biology");
    expect(html).toContain('class="opt correct"');
  });
});

describe("buildExportFiles", () => {
  it("always includes a README plus a file per chosen format", () => {
    const files = buildExportFiles(makeExport(), ["html", "csv"]);
    expect(Object.keys(files).sort()).toEqual([
      "README.txt",
      "chat-records.csv",
      "chat-records.html",
    ]);
  });

  it("includes only the README and the single chosen format", () => {
    const files = buildExportFiles(makeExport(), ["text"]);
    expect(Object.keys(files).sort()).toEqual([
      "README.txt",
      "chat-records.txt",
    ]);
  });

  it("produces a valid zip whose entries round-trip unchanged", () => {
    // Mirrors what downloadConversationsExport zips, minus the DOM download.
    const files = buildExportFiles(makeExport(), ["html", "csv", "text"]);
    const zipInput: Record<string, Uint8Array> = {};
    for (const [name, contents] of Object.entries(files)) {
      // Re-wrap through the test realm's Uint8Array. jest.setup polyfills
      // TextEncoder from node:util, so fflate's strToU8 returns a cross-realm
      // array that zipSync's `instanceof Uint8Array` check would treat as a
      // folder. A real browser has a single realm, so downloadConversationsExport
      // needs no such wrapping.
      zipInput[name] = Uint8Array.from(strToU8(contents));
    }
    const unzipped = unzipSync(zipSync(zipInput));

    expect(Object.keys(unzipped).sort()).toEqual([
      "README.txt",
      "chat-records.csv",
      "chat-records.html",
      "chat-records.txt",
    ]);
    // UTF-8 content survives the zip round-trip byte-for-byte.
    expect(strFromU8(unzipped["chat-records.txt"]!)).toBe(
      files["chat-records.txt"],
    );
    // The archived CSV keeps its UTF-8 BOM in the bytes (TextDecoder strips a
    // leading BOM on decode, so compare the decoded body without it).
    const csvBytes = unzipped["chat-records.csv"]!;
    expect(Array.from(csvBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(strFromU8(csvBytes)).toBe(
      files["chat-records.csv"].replace("\uFEFF", ""),
    );
  });
});
