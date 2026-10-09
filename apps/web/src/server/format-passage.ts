/**
 * A passage as the model sees it, with the stored file name (a crawled page's
 * title or URL) so it can cite it. Both the injected context and the
 * fallback's searched passages use it, so a prompt carrying both cites sources
 * one way.
 */
export function formatPassage(
  rawName: string,
  chunkIndex: number,
  content: string,
): string {
  return `[Source: ${rawName}, Part ${chunkIndex + 1}]\n${content}`;
}
