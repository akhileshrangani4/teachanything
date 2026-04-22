import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock officeparser before importing the module under test
jest.unstable_mockModule("officeparser", () => ({
  parseOffice: jest.fn(),
}));

// Dynamic import after mock setup (ESM pattern per AGENTS.md)
const { RAGService } = await import("../rag-service");

// Helper to build a mock AST matching officeparser's structure
function buildMockAST(
  nodes: Array<{
    type: string;
    slideNumber: number;
    noteId?: string;
    children: Array<{ type: string; text: string }>;
  }>,
) {
  return {
    content: nodes.map((n) => ({
      type: n.type,
      children: n.children,
      metadata: {
        slideNumber: n.slideNumber,
        ...(n.noteId ? { noteId: n.noteId } : {}),
      },
    })),
    toText: () =>
      nodes.flatMap((n) => n.children.map((c) => c.text)).join("\n"),
  };
}

describe("extractPowerPoint", () => {
  let service: InstanceType<typeof RAGService>;
  let mockParseOffice: jest.Mock;

  beforeEach(async () => {
    service = new RAGService();
    const officeparser = await import("officeparser");
    mockParseOffice = officeparser.parseOffice as jest.Mock;
    mockParseOffice.mockReset();
  });

  it("extracts slides with speaker notes", async () => {
    mockParseOffice.mockResolvedValue(
      buildMockAST([
        {
          type: "slide",
          slideNumber: 1,
          children: [
            { type: "heading", text: "Introduction to ML" },
            { type: "paragraph", text: "Overview of key concepts" },
          ],
        },
        {
          type: "note",
          slideNumber: 1,
          noteId: "slide-note-1",
          children: [{ type: "paragraph", text: "Welcome the audience" }],
        },
        {
          type: "slide",
          slideNumber: 2,
          children: [{ type: "heading", text: "Key Concepts" }],
        },
        {
          type: "note",
          slideNumber: 2,
          noteId: "slide-note-2",
          children: [
            { type: "paragraph", text: "Explain each concept slowly" },
          ],
        },
      ]),
    );

    const result = await service.extractContent(
      Buffer.from("fake"),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    expect(result).toContain("--- Slide 1 ---");
    expect(result).toContain("Introduction to ML");
    expect(result).toContain("Overview of key concepts");
    expect(result).toContain("[Speaker Notes]");
    expect(result).toContain("Welcome the audience");
    expect(result).toContain("--- Slide 2 ---");
    expect(result).toContain("Key Concepts");
    expect(result).toContain("Explain each concept slowly");
  });

  it("handles slides without speaker notes", async () => {
    mockParseOffice.mockResolvedValue(
      buildMockAST([
        {
          type: "slide",
          slideNumber: 1,
          children: [{ type: "heading", text: "Title Slide" }],
        },
        {
          type: "slide",
          slideNumber: 2,
          children: [{ type: "paragraph", text: "Content here" }],
        },
      ]),
    );

    const result = await service.extractContent(
      Buffer.from("fake"),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    expect(result).toContain("--- Slide 1 ---");
    expect(result).toContain("Title Slide");
    expect(result).toContain("--- Slide 2 ---");
    expect(result).toContain("Content here");
    expect(result).not.toContain("[Speaker Notes]");
  });

  it("throws on empty presentation", async () => {
    mockParseOffice.mockResolvedValue(buildMockAST([]));

    await expect(
      service.extractContent(
        Buffer.from("fake"),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).rejects.toThrow("no readable text content");
  });

  it("wraps officeparser errors", async () => {
    mockParseOffice.mockRejectedValue(new Error("Corrupted file"));

    await expect(
      service.extractContent(
        Buffer.from("fake"),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).rejects.toThrow("Failed to extract PowerPoint content: Corrupted file");
  });

  it("sanitizes null bytes in content", async () => {
    mockParseOffice.mockResolvedValue(
      buildMockAST([
        {
          type: "slide",
          slideNumber: 1,
          children: [{ type: "paragraph", text: "Clean\0text\0here" }],
        },
      ]),
    );

    const result = await service.extractContent(
      Buffer.from("fake"),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    expect(result).not.toContain("\0");
    expect(result).toContain("Cleantexthere");
  });

  it("orders out-of-order slides by slide number", async () => {
    mockParseOffice.mockResolvedValue(
      buildMockAST([
        {
          type: "slide",
          slideNumber: 3,
          children: [{ type: "paragraph", text: "Third slide" }],
        },
        {
          type: "slide",
          slideNumber: 1,
          children: [{ type: "paragraph", text: "First slide" }],
        },
        {
          type: "slide",
          slideNumber: 2,
          children: [{ type: "paragraph", text: "Second slide" }],
        },
      ]),
    );

    const result = await service.extractContent(
      Buffer.from("fake"),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    const slide1Pos = result.indexOf("--- Slide 1 ---");
    const slide2Pos = result.indexOf("--- Slide 2 ---");
    const slide3Pos = result.indexOf("--- Slide 3 ---");

    expect(slide1Pos).toBeLessThan(slide2Pos);
    expect(slide2Pos).toBeLessThan(slide3Pos);
  });
});
