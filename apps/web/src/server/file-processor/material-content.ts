import { assertFileSignature, type RAGService } from "@teachanything/ai";
import { extractOfficeImages, type OfficeImage } from "./office-images";
import {
  analyzeImages,
  analyzePdf,
  type VisualSection,
} from "./visual-analysis";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const VISUAL_TIMEOUT_MS = 120_000;

export interface MaterialChunk {
  content: string;
  pageNumber?: number;
  section?: string;
}

export interface MaterialContent {
  chunks: MaterialChunk[];
  visualCount: number;
  visionModel?: string;
}

function isEmptyNativeContent(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("no readable text content")
  );
}

async function chunkVisualSections(
  ragService: RAGService,
  sections: VisualSection[],
): Promise<MaterialChunk[]> {
  const chunks: MaterialChunk[] = [];
  for (const visual of sections) {
    const location = visual.pageNumber
      ? `Page ${visual.pageNumber}`
      : visual.section || "Image";
    const prefixed = `[Visual analysis — ${location}]\n${visual.content}`;
    for (const content of await ragService.chunkText(prefixed)) {
      chunks.push({
        content,
        ...(visual.pageNumber == null ? {} : { pageNumber: visual.pageNumber }),
        ...(visual.section == null ? {} : { section: visual.section }),
      });
    }
  }
  return chunks;
}

async function nativeChunks(
  ragService: RAGService,
  buffer: Buffer,
  mimeType: string,
) {
  try {
    return await ragService.extractAndChunkWithMetadata(buffer, mimeType);
  } catch (error) {
    if (
      (mimeType === DOCX_MIME || mimeType === PPTX_MIME) &&
      isEmptyNativeContent(error)
    ) {
      return { chunks: [] };
    }
    throw error;
  }
}

function standaloneImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): OfficeImage {
  assertFileSignature(buffer, mimeType);
  return {
    data: buffer,
    mimeType,
    label: fileName,
    section: "Image",
    sourcePath: fileName,
  };
}

/** Build native and visual chunks while enforcing one total visual-analysis deadline. */
export async function extractMaterialContent(params: {
  ragService: RAGService;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  apiKey: string;
  visionModel: string;
  onVisualAnalysis?: () => Promise<void>;
}): Promise<MaterialContent> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error(
          `Visual analysis timed out after ${VISUAL_TIMEOUT_MS / 1000}s`,
        ),
      ),
    VISUAL_TIMEOUT_MS,
  );

  try {
    if (IMAGE_MIMES.has(params.mimeType)) {
      await params.onVisualAnalysis?.();
      const visual = await analyzeImages({
        images: [
          standaloneImage(params.buffer, params.mimeType, params.fileName),
        ],
        apiKey: params.apiKey,
        model: params.visionModel,
        signal: controller.signal,
      });
      return {
        chunks: await chunkVisualSections(params.ragService, visual.sections),
        visualCount: visual.visualCount,
        visionModel: visual.model,
      };
    }

    const native = await nativeChunks(
      params.ragService,
      params.buffer,
      params.mimeType,
    );
    if (params.mimeType === PDF_MIME) {
      const pageCount = native.pageCount ?? 0;
      await params.onVisualAnalysis?.();
      const visual = await analyzePdf({
        buffer: params.buffer,
        fileName: params.fileName,
        pageCount,
        hasNativeText: native.chunks.length > 0,
        apiKey: params.apiKey,
        model: params.visionModel,
        signal: controller.signal,
      });
      for (const section of visual.sections) {
        if (
          section.pageNumber == null ||
          section.pageNumber < 1 ||
          section.pageNumber > pageCount
        ) {
          throw new Error(
            "OpenAI visual analysis returned invalid PDF page attribution",
          );
        }
      }
      return {
        chunks: [
          ...native.chunks,
          ...(await chunkVisualSections(params.ragService, visual.sections)),
        ],
        visualCount: visual.visualCount,
        visionModel: visual.model,
      };
    }

    if (params.mimeType === DOCX_MIME || params.mimeType === PPTX_MIME) {
      const images = extractOfficeImages(params.buffer, params.mimeType);
      if (images.length === 0) {
        if (native.chunks.length === 0) {
          throw new Error("Office document contains no readable content");
        }
        return { chunks: native.chunks, visualCount: 0 };
      }
      await params.onVisualAnalysis?.();
      const visual = await analyzeImages({
        images,
        apiKey: params.apiKey,
        model: params.visionModel,
        signal: controller.signal,
      });
      return {
        chunks: [
          ...native.chunks,
          ...(await chunkVisualSections(params.ragService, visual.sections)),
        ],
        visualCount: visual.visualCount,
        visionModel: visual.model,
      };
    }

    return { chunks: native.chunks, visualCount: 0 };
  } finally {
    clearTimeout(timeout);
  }
}
