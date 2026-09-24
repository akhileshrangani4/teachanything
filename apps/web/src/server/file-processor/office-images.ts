import { createHash } from "node:crypto";
import { posix } from "node:path";
import { assertFileSignature } from "@teachanything/ai";
import { unzipSync } from "fflate";

const MAX_OFFICE_IMAGES = 40;
const MAX_OFFICE_IMAGE_BYTES = 25 * 1024 * 1024;

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export interface OfficeImage {
  data: Buffer;
  mimeType: string;
  label: string;
  section: string;
  sourcePath: string;
}

function decode(entry?: Uint8Array): string {
  return entry ? Buffer.from(entry).toString("utf8") : "";
}

function normalizeTarget(sourcePart: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  return posix.normalize(posix.join(posix.dirname(sourcePart), target));
}

function parseRelationships(
  xml: string,
  sourcePart: string,
): Map<string, string> {
  const relationships = new Map<string, string>();
  for (const tag of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = tag[0].match(/\bId=["']([^"']+)["']/)?.[1];
    const target = tag[0].match(/\bTarget=["']([^"']+)["']/)?.[1];
    if (id && target) {
      relationships.set(id, normalizeTarget(sourcePart, target));
    }
  }
  return relationships;
}

function embeddedRelationshipIds(xml: string): string[] {
  return [...xml.matchAll(/\br:embed=["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  );
}

function numericPart(path: string, pattern: RegExp): number {
  return Number(path.match(pattern)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function referencedImages(
  entries: Record<string, Uint8Array>,
  mimeType: string,
): Map<string, Set<string>> {
  const references = new Map<string, Set<string>>();
  const add = (path: string, section: string) => {
    const current = references.get(path) ?? new Set<string>();
    current.add(section);
    references.set(path, current);
  };

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const slidePaths = Object.keys(entries)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort(
        (a, b) =>
          numericPart(a, /slide(\d+)\.xml$/) -
          numericPart(b, /slide(\d+)\.xml$/),
      );

    for (const slidePath of slidePaths) {
      const slideNumber = numericPart(slidePath, /slide(\d+)\.xml$/);
      const relationshipsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
      const relationships = parseRelationships(
        decode(entries[relationshipsPath]),
        slidePath,
      );
      for (const id of embeddedRelationshipIds(decode(entries[slidePath]))) {
        const target = relationships.get(id);
        if (target) add(target, `Slide ${slideNumber}`);
      }
    }
  } else {
    const sourcePart = "word/document.xml";
    const relationships = parseRelationships(
      decode(entries["word/_rels/document.xml.rels"]),
      sourcePart,
    );
    let imageNumber = 0;
    for (const id of embeddedRelationshipIds(decode(entries[sourcePart]))) {
      const target = relationships.get(id);
      if (target) add(target, `Document image ${++imageNumber}`);
    }
  }

  return references;
}

function supportedMediaPath(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return Boolean(IMAGE_MIME_BY_EXTENSION[extension]);
}

/** Extract referenced raster media without expanding unrelated Office ZIP entries. */
export function extractOfficeImages(
  buffer: Buffer,
  mimeType: string,
): OfficeImage[] {
  let archiveImageCount = 0;
  let archiveImageBytes = 0;
  const entries = unzipSync(new Uint8Array(buffer), {
    filter: (file) => {
      if (supportedMediaPath(file.name)) {
        archiveImageCount += 1;
        archiveImageBytes += file.originalSize;
        if (archiveImageCount > MAX_OFFICE_IMAGES) {
          throw new Error(
            `This Office file contains more than ${MAX_OFFICE_IMAGES} images. Split it into smaller files and upload them separately.`,
          );
        }
        if (archiveImageBytes > MAX_OFFICE_IMAGE_BYTES) {
          throw new Error(
            "The images embedded in this Office file exceed 25 MB. Split it into smaller files and upload them separately.",
          );
        }
        return true;
      }
      return (
        /^ppt\/slides\/slide\d+\.xml$/.test(file.name) ||
        /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(file.name) ||
        file.name === "word/document.xml" ||
        file.name === "word/_rels/document.xml.rels"
      );
    },
  });
  const references = referencedImages(entries, mimeType);
  const mediaPaths = Object.keys(entries).filter(supportedMediaPath).sort();

  for (const path of mediaPaths) {
    if (!references.has(path))
      references.set(path, new Set(["Embedded image"]));
  }

  const unique = new Map<string, OfficeImage & { sections: Set<string> }>();
  for (const [path, sections] of references) {
    const entry = entries[path];
    if (!entry || !supportedMediaPath(path)) continue;
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    const imageMimeType = IMAGE_MIME_BY_EXTENSION[extension]!;
    const data = Buffer.from(entry);
    assertFileSignature(data, imageMimeType);
    const digest = createHash("sha256").update(data).digest("hex");
    const existing = unique.get(digest);
    if (existing) {
      for (const section of sections) existing.sections.add(section);
      continue;
    }
    unique.set(digest, {
      data,
      mimeType: imageMimeType,
      label: "",
      section: "",
      sourcePath: path,
      sections: new Set(sections),
    });
  }

  const totalBytes = [...unique.values()].reduce(
    (sum, image) => sum + image.data.length,
    0,
  );
  if (unique.size > MAX_OFFICE_IMAGES) {
    throw new Error(
      `This Office file contains ${unique.size} images; the limit is ${MAX_OFFICE_IMAGES}. Split it into smaller files and upload them separately.`,
    );
  }
  if (totalBytes > MAX_OFFICE_IMAGE_BYTES) {
    throw new Error(
      "The images embedded in this Office file exceed 25 MB. Split it into smaller files and upload them separately.",
    );
  }

  return [...unique.values()].map((image, index) => {
    const section = [...image.sections].join(", ");
    return {
      data: image.data,
      mimeType: image.mimeType,
      label: `Image ${index + 1} (${section})`,
      section,
      sourcePath: image.sourcePath,
    };
  });
}
