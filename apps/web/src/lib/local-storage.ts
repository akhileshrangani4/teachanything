/**
 * Local filesystem storage for development.
 * Used as a fallback when Supabase Storage is not configured.
 * Files are saved to ./uploads/{storagePath} relative to the web app root.
 */

import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import { join, dirname, resolve } from "path";
import { isServiceAvailable } from "./env";

/** Root directory for local file storage */
const UPLOADS_DIR = join(process.cwd(), "uploads");

/** Whether to use local filesystem instead of Supabase */
export function isLocalStorageMode(): boolean {
  return !isServiceAvailable("supabase-storage");
}

/** Resolve a storage path to an absolute filesystem path */
function resolveStoragePath(storagePath: string): string {
  const resolved = resolve(UPLOADS_DIR, storagePath);
  if (!resolved.startsWith(UPLOADS_DIR + "/")) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

/** Save a file to local storage */
export async function saveLocalFile(
  storagePath: string,
  data: Buffer,
): Promise<void> {
  const filePath = resolveStoragePath(storagePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

/** Read a file from local storage */
export async function readLocalFile(storagePath: string): Promise<Buffer> {
  const filePath = resolveStoragePath(storagePath);
  return readFile(filePath);
}

/** Delete a file from local storage */
export async function deleteLocalFile(storagePath: string): Promise<void> {
  const filePath = resolveStoragePath(storagePath);
  try {
    await unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

/** Check if a file exists in local storage */
export async function localFileExists(storagePath: string): Promise<boolean> {
  const filePath = resolveStoragePath(storagePath);
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Get file size in bytes from local storage */
export async function getLocalFileSize(storagePath: string): Promise<number> {
  const filePath = resolveStoragePath(storagePath);
  const stats = await stat(filePath);
  return stats.size;
}
