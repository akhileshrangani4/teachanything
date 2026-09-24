/** @jest-environment node */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { analyzeImages } from "@/server/file-processor/visual-analysis";
import type { OfficeImage } from "@/server/file-processor/office-images";

function image(label: string, size = 8): OfficeImage {
  return {
    data: Buffer.alloc(size, 1),
    mimeType: "image/png",
    label,
    section: label,
    sourcePath: label,
  };
}

function successfulResponse(labels: string[]): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                sections: labels.map((label) => ({
                  pageNumber: null,
                  sourceLabel: label,
                  content: `Description for ${label}`,
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

afterEach(() => jest.restoreAllMocks());

describe("visual analysis", () => {
  it("passes the deployment-selected model and high-detail image", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(successfulResponse(["diagram.png"]));

    const result = await analyzeImages({
      images: [image("diagram.png")],
      apiKey: "sk-test",
      model: "gpt-6-luna",
      signal: new AbortController().signal,
    });

    const options = fetchSpy.mock.calls[0]![1]!;
    const body = JSON.parse(String(options.body)) as {
      model: string;
      input: Array<{ content: Array<Record<string, unknown>> }>;
    };
    expect(body.model).toBe("gpt-6-luna");
    expect(body.input[0]!.content).toContainEqual(
      expect.objectContaining({ type: "input_image", detail: "high" }),
    );
    expect(result.model).toBe("gpt-6-luna");
    expect(result.visualCount).toBe(1);
  });

  it("retries a transient provider failure", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(successfulResponse(["diagram.png"]));

    await analyzeImages({
      images: [image("diagram.png")],
      apiKey: "sk-test",
      model: "gpt-6-sol",
      signal: new AbortController().signal,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("surfaces an incompatible model as configuration error", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Model does not support images" },
        }),
        { status: 400 },
      ),
    );

    await expect(
      analyzeImages({
        images: [image("diagram.png")],
        apiKey: "sk-test",
        model: "text-only-model",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/unavailable or incompatible/);
  });

  it("batches by the ten-image request limit without losing attribution", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, options) => {
        const body = JSON.parse(String(options?.body)) as {
          input: Array<{ content: Array<{ type: string; text?: string }> }>;
        };
        const labels = body.input[0]!.content.filter((part) =>
          part.text?.startsWith("Source label: "),
        ).map((part) => part.text!.replace("Source label: ", ""));
        return successfulResponse(labels);
      });
    const images = Array.from({ length: 11 }, (_, i) => image(`image-${i}`));

    const result = await analyzeImages({
      images,
      apiKey: "sk-test",
      model: "gpt-6-sol",
      signal: new AbortController().signal,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.sections).toHaveLength(11);
  });

  it("rejects an image over the decoded request limit", async () => {
    await expect(
      analyzeImages({
        images: [image("huge.png", 10 * 1024 * 1024 + 1)],
        apiKey: "sk-test",
        model: "gpt-6-sol",
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/larger than 10 MB/);
  });
});
