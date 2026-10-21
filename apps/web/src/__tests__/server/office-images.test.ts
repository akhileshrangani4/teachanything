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

  it("fails instead of silently truncating more than 40 referenced images", () => {
    const entries: Record<string, Uint8Array> = {
      "word/document.xml": bytes(
        Array.from(
          { length: 41 },
          (_, i) => `<a:blip r:embed="rId${i}"/>`,
        ).join(""),
      ),
      "word/_rels/document.xml.rels": bytes(
        Array.from(
          { length: 41 },
          (_, i) => `<Relationship Id="rId${i}" Target="media/image${i}.png"/>`,
        ).join(""),
      ),
    };
    for (let i = 0; i < 41; i++) {
      entries[`word/media/image${i}.png`] = png(i);
    }
    const archive = zipSync(entries);
    expect(() => extractOfficeImages(Buffer.from(archive), DOCX_MIME)).toThrow(
      /contains 41 images; the limit is 40/,
    );
  });

  it("analyzes exactly the referenced images when orphaned media passes the caps", () => {
    const entries: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": bytes(
        '<a:blip r:embed="rId1"/><a:blip r:embed="rId2"/><a:blip r:embed="rId3"/>',
      ),
      "ppt/slides/_rels/slide1.xml.rels": bytes(
        '<Relationship Id="rId1" Target="../media/real1.png"/>' +
          '<Relationship Id="rId2" Target="../media/real2.png"/>' +
          '<Relationship Id="rId3" Target="../media/real3.png"/>',
      ),
    };
    for (let i = 0; i < 60; i++) {
      entries[`ppt/media/orphan${i}.png`] = png(i);
    }
    entries["ppt/media/real1.png"] = png(101);
    entries["ppt/media/real2.png"] = png(102);
    entries["ppt/media/real3.png"] = png(103);

    const images = extractOfficeImages(
      Buffer.from(zipSync(entries)),
      PPTX_MIME,
    );
    expect(images).toHaveLength(3);
    expect(images.every((image) => image.section.startsWith("Slide 1"))).toBe(
      true,
    );
  });

  it("evicts oversized orphaned media instead of failing a deck whose referenced images fit", () => {
    const oversized = (marker: number) => {
      const data = new Uint8Array(7 * 1024 * 1024);
      data.set([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
      // Vary the payload so identical-size images stay distinct under dedupe.
      data[8] = marker;
      return data;
    };
    const entries: Record<string, Uint8Array> = {
      "word/document.xml": bytes(
        '<a:blip r:embed="rId1"/><a:blip r:embed="rId2"/><a:blip r:embed="rId3"/>',
      ),
      "word/_rels/document.xml.rels": bytes(
        '<Relationship Id="rId1" Target="media/real1.png"/>' +
          '<Relationship Id="rId2" Target="media/real2.png"/>' +
          '<Relationship Id="rId3" Target="media/real3.png"/>',
      ),
      "word/media/real1.png": oversized(1),
      "word/media/real2.png": oversized(2),
      "word/media/real3.png": oversized(3),
      "word/media/orphan.png": oversized(4),
    };

    const images = extractOfficeImages(
      Buffer.from(zipSync(entries)),
      DOCX_MIME,
    );
    expect(images).toHaveLength(3);
    expect(
      images.every((image) => image.sourcePath !== "word/media/orphan.png"),
    ).toBe(true);
  });
});
