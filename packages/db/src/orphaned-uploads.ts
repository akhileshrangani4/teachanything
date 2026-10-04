/**
 * Finds uploaded files in Storage that no user_files row points at.
 *
 * Uploads go straight from the browser to Storage on a signed URL, and only
 * then does the client call finalizeUpload to create the row. A tab closed
 * between those two steps leaves an object nothing will ever delete, so no
 * server-side fix can stop orphans entirely; they have to be swept.
 *
 * Shared by scripts/sweep-orphaned-uploads.ts and its tests.
 */

export const UPLOAD_BUCKET = "chatbot-files";

/**
 * Signed upload URLs expire after 15 minutes. A day of margin means an upload
 * that is still on its way to finalizeUpload is never mistaken for an orphan.
 */
export const ORPHAN_MIN_AGE_HOURS = 24;

/** Storage's delete endpoint takes a list of paths; keep each call modest. */
export const REMOVE_BATCH_SIZE = 100;

export const ORPHANED_UPLOADS_QUERY = `
  SELECT o.name AS path,
         COALESCE((o.metadata->>'size')::bigint, 0) AS size,
         o.created_at AS "createdAt"
  FROM storage.objects o
  WHERE o.bucket_id = '${UPLOAD_BUCKET}'
    AND o.created_at < now() - interval '${ORPHAN_MIN_AGE_HOURS} hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_files f WHERE f.storage_path = o.name
    )
  ORDER BY o.created_at
`;

export interface OrphanedUpload {
  path: string;
  size: number;
  createdAt: Date;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error(`chunk size must be at least 1, got ${size}`);
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatOrphanReport(
  orphans: readonly OrphanedUpload[],
  sampleSize = 10,
): string {
  if (orphans.length === 0) return "No orphaned uploads found.";

  const totalBytes = orphans.reduce((sum, o) => sum + o.size, 0);
  const largest = [...orphans]
    .sort((a, b) => b.size - a.size)
    .slice(0, sampleSize)
    .map(
      (o) =>
        `  ${o.path}  ${formatMegabytes(o.size)}  ${o.createdAt.toISOString().slice(0, 10)}`,
    );

  return [
    `${orphans.length} orphaned uploads, ${formatMegabytes(totalBytes)} total.`,
    `Largest ${largest.length}:`,
    ...largest,
  ].join("\n");
}
