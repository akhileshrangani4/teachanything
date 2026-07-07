import { describe, it, expect } from "@jest/globals";
import { RAGService } from "../rag-service";

describe("RAGService page-aware chunking", () => {
  it("chunkPagedText assigns page numbers and never spans pages", async () => {
    const svc = new RAGService();
    const page1 = "Alpha. ".repeat(400); // long -> multiple ~1000-char chunks
    const page2 = "Beta lives on page two.";
    const text = `${page1}\f${page2}`;

    const chunks = await svc.chunkPagedText(text);

    expect(chunks.every((c) => typeof c.pageNumber === "number")).toBe(true);
    const beta = chunks.filter((c) => c.content.includes("Beta lives"));
    expect(beta.length).toBeGreaterThan(0);
    expect(beta.every((c) => c.pageNumber === 2)).toBe(true);
    const p1 = chunks.filter((c) => c.pageNumber === 1);
    expect(p1.length).toBeGreaterThan(1);
    expect(
      chunks.some(
        (c) => c.content.includes("Alpha") && c.content.includes("Beta lives"),
      ),
    ).toBe(false);
  });

  it("skips empty pages but keeps 1-based numbering by position", async () => {
    const svc = new RAGService();
    const chunks = await svc.chunkPagedText("Page one.\f\fPage three.");
    const pages = new Set(chunks.map((c) => c.pageNumber));
    expect(
      chunks.find((c) => c.content.includes("Page three"))?.pageNumber,
    ).toBe(3);
    expect([...pages]).not.toContain(2);
  });
});
