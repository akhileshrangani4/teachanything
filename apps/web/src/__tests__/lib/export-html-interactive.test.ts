/**
 * @jest-environment jsdom
 *
 * Drives the exported HTML page's own client script in jsdom to verify the
 * interactive master-detail behavior: a searchable conversation list that swaps
 * the detail pane on selection.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  buildHtml,
  type ConversationsExport,
} from "@/lib/export-conversations";

const sample: ConversationsExport = {
  chatbotName: "Cell Biology",
  exportedAt: "2026-07-18T15:00:00.000Z",
  truncated: false,
  maxConversations: 1000,
  conversations: [
    {
      id: "conv-1",
      sessionId: "sess-1",
      createdAt: "2026-07-16T14:02:00.000Z",
      messages: [
        {
          role: "user",
          content: "Explain mitochondria",
          createdAt: "2026-07-16T14:02:01.000Z",
          sources: [],
        },
        {
          role: "assistant",
          content: "The powerhouse of the cell.",
          createdAt: "2026-07-16T14:02:06.000Z",
          sources: [],
        },
      ],
    },
    {
      id: "conv-2",
      sessionId: "sess-2",
      createdAt: "2026-07-17T09:00:00.000Z",
      messages: [
        {
          role: "user",
          content: "What is osmosis?",
          createdAt: "2026-07-17T09:00:01.000Z",
          sources: [],
        },
      ],
    },
  ],
};

function bootPage(html: string): void {
  const bodyInner = html.match(/<body>([\s\S]*)<\/body>/)![1]!;
  document.body.innerHTML = bodyInner;
  // innerHTML-inserted <script> tags don't execute in jsdom, so run the app
  // script explicitly (the untyped one; the other is the JSON data island).
  const appScript = Array.from(document.querySelectorAll("script")).find(
    (s) => !s.getAttribute("type"),
  );
  eval(appScript!.textContent!);
}

describe("exported HTML interactivity", () => {
  beforeEach(() => {
    bootPage(buildHtml(sample));
  });

  it("renders one list item per conversation and opens the first by default", () => {
    const items = document.querySelectorAll(".conv-item");
    expect(items).toHaveLength(2);
    expect(document.querySelector(".conv-item.active")).not.toBeNull();
    expect(document.getElementById("detail")!.innerHTML).toContain(
      "Explain mitochondria",
    );
  });

  it("filters the list by search text", () => {
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "osmosis";
    search.dispatchEvent(new Event("input"));
    const items = document.querySelectorAll(".conv-item");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain("What is osmosis?");
  });

  it("swaps the detail pane when a conversation is clicked", () => {
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "osmosis";
    search.dispatchEvent(new Event("input"));
    (document.querySelector(".conv-item") as HTMLButtonElement).click();
    expect(document.getElementById("detail")!.innerHTML).toContain(
      "What is osmosis?",
    );
    expect(document.body.classList.contains("viewing-detail")).toBe(true);
  });

  it("shows a no-matches message when search matches nothing", () => {
    const search = document.getElementById("search") as HTMLInputElement;
    search.value = "zzzznope";
    search.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll(".conv-item")).toHaveLength(0);
    expect(document.getElementById("list")!.textContent).toContain(
      "No matching chats.",
    );
  });
});
