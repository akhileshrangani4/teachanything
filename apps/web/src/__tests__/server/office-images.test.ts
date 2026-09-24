/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { zipSync } from "fflate";
import { extractOfficeImages } from "@/server/file-processor/office-images";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const png = (marker = 0) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, marker]);
const bytes = (value: string) => new TextEncoder().encode(value);

describe("extractOfficeImages", () => {
  it("attributes PowerPoint images to slides and deduplicates repeated media", () => {
    const archive = zipSync({
      "ppt/slides/slide1.xml": bytes('<a:blip r:embed="rId1"/>'),
      "ppt/slides/_rels/slide1.xml.rels": bytes(
        '<Relationship Id="rId1" Target="../media/image1.png"/>',
      ),
      "ppt/slides/slide2.xml": bytes('<a:blip r:embed="rId2"/>'),
      "ppt/slides/_rels/slide2.xml.rels": bytes(
        '<Relationship Id="rId2" Target="../media/image2.png"/>',
      ),
      "ppt/media/image1.png": png(),
      "ppt/media/image2.png": png(),
    });

    const images = extractOfficeImages(Buffer.from(archive), PPTX_MIME);
    expect(images).toHaveLength(1);
    expect(images[0]!.section).toContain("Slide 1");
    expect(images[0]!.section).toContain("Slide 2");
  });

  it("preserves Word document image order", () => {
    const archive = zipSync({
      "word/document.xml": bytes(
        '<a:blip r:embed="rId2"/><a:blip r:embed="rId1"/>',
      ),
      "word/_rels/document.xml.rels": bytes(
        '<Relationship Id="rId1" Target="media/first.png"/><Relationship Id="rId2" Target="media/second.png"/>',
      ),
      "word/media/first.png": png(1),
      "word/media/second.png": png(2),
    });

    const images = extractOfficeImages(Buffer.from(archive), DOCX_MIME);
    expect(images.map((entry) => entry.sourcePath)).toEqual([
      "word/media/second.png",
      "word/media/first.png",
    ]);
    expect(images.map((entry) => entry.section)).toEqual([
      "Document image 1",
      "Document image 2",
    ]);
  });

  it("fails instead of silently truncating more than 40 unique images", () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 41; i++) {
      entries[`word/media/image${i}.png`] = png(i);
    }
    const archive = zipSync(entries);
    expect(() => extractOfficeImages(Buffer.from(archive), DOCX_MIME)).toThrow(
      /more than 40 images/,
    );
  });
});
