/**
 * Direct file upload utilities
 * Uploads to Supabase Storage (production) or local API (development)
 * This bypasses API body size limits and provides better performance
 */

import { trpc } from "@/lib/trpc";

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface DirectUploadResult {
  fileId: string;
  status: "pending";
}

/**
 * React hook for direct client-to-Supabase file uploads
 * Provides progress tracking and bypasses API body size limits
 */
export function useDirectUpload() {
  const createUploadUrl = trpc.files.createUploadUrl.useMutation();
  const finalizeUpload = trpc.files.finalizeUpload.useMutation();

  const uploadFile = async (
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<DirectUploadResult> => {
    // Step 1: Get signed upload URL
    const uploadUrlData = await createUploadUrl.mutateAsync({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    const { uploadUrl, fileId, storagePath } = uploadUrlData;

    // Step 2: Upload file to storage (Supabase or local API)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Set timeout: 10 minutes for large files
      xhr.timeout = 10 * 60 * 1000;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded / e.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload was cancelled"));
      });

      xhr.addEventListener("timeout", () => {
        reject(
          new Error(
            "Upload timed out after 10 minutes. Please try a smaller file or check your connection.",
          ),
        );
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });

    // Step 3: Finalize upload
    const result = await finalizeUpload.mutateAsync({
      fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath,
    });

    return result;
  };

  return {
    uploadFile,
    isLoading: createUploadUrl.isPending || finalizeUpload.isPending,
    error: createUploadUrl.error || finalizeUpload.error,
  };
}
