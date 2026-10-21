/** @jest-environment node */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { RAGService } from "@teachanything/ai";
import { extractMaterialContent } from "@/server/file-processor/material-content";

function pdfResponse(
  sections: Array<{ pageNumber: number; content: string }>,
): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                sections: sections.map((section) => ({
                  pageNumber: section.pageNumber,
                  sourceLabel: `page ${section.pageNumber}`,
                  content: section.content,
                })),
              }),
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Minimal double: extractMaterialContent only calls
 * extractAndChunkWithMetadata and chunkText. RAGService is a concrete class,
 * so the partial shape needs the escape hatch.
 */
function ragServiceDouble(extracted: {
  chunks: Array<{ content: string; pageNumber?: number }>;
  pageCount?: number;
}): RAGService {
  return {
    extractAndChunkWithMetadata: async () => extracted,
    chunkText: async (content: string) => [content],
  } as unknown as RAGService;
}

afterEach(() => jest.restoreAllMocks());

describe("extractMaterialContent PDF cost gate", () => {
  it("text-native PDF: zero vision calls, no visual stage, no recorded vision model", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        pdfResponse([{ pageNumber: 1, content: "should never be fetched" }]),
      );
    const onVisualAnalysis = jest.fn(async () => {});

    const material = await extractMaterialContent({
      ragService: ragServiceDouble({
        chunks: [{ content: "slide body text", pageNumber: 2 }],
        pageCount: 12,
      }),
      buffer: Buffer.from("%PDF-1.4 fixture"),
      mimeType: "application/pdf",
      fileName: "lecture.pdf",
      apiKey: "sk-test",
      visionModel: "gpt-6-sol",
      onVisualAnalysis,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(onVisualAnalysis).not.toHaveBeenCalled();
    expect(material.chunks).toHaveLength(1);
    expect(material.chunks[0]!.content).toBe("slide body text");
    expect(material.chunks[0]!.pageNumber).toBe(2);
    expect(material.visualCount).toBe(0);
    expect(material.visionModel).toBeUndefined();
  });

  it("scanned PDF: the vision model still runs, progresses, and is recorded", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        pdfResponse([
          { pageNumber: 1, content: "Handwritten diagram of a cell" },
        ]),
      );
    const onVisualAnalysis = jest.fn(async () => {});

    const material = await extractMaterialContent({
      ragService: ragServiceDouble({ chunks: [], pageCount: 2 }),
      buffer: Buffer.from("%PDF-1.4 fixture"),
      mimeType: "application/pdf",
      fileName: "scan.pdf",
      apiKey: "sk-test",
      visionModel: "gpt-6-sol",
      onVisualAnalysis,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onVisualAnalysis).toHaveBeenCalledTimes(1);
    expect(
      material.chunks.some((chunk) =>
        chunk.content.includes("Handwritten diagram of a cell"),
      ),
    ).toBe(true);
    expect(material.visionModel).toBe("gpt-6-sol");
  });
});
