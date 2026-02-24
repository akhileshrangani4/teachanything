import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@teachanything/db";
import { userFiles } from "@teachanything/db/schema";
import { eq, and } from "drizzle-orm";
import { createSupabaseClient } from "@/lib/supabase";
import { isLocalStorageMode, readLocalFile } from "@/lib/local-storage";
import { logError, logInfo } from "@/lib/logger";
import { downloadRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

/**
 * Secure file download endpoint
 * - Validates session on EVERY request (URLs cannot be shared)
 * - Rate limited to prevent abuse
 * - Logs all download attempts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { fileId } = await params;

    // Validate session - this is checked on EVERY request
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (skipped when Redis is not configured)
    const { success, reset } = await checkRateLimit(
      downloadRateLimit,
      session.user.id,
      { context: "file-download" },
    );
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Too many downloads. Please try again in ${retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
          },
        },
      );
    }

    // Get file record and verify ownership
    const [file] = await db
      .select()
      .from(userFiles)
      .where(
        and(eq(userFiles.id, fileId), eq(userFiles.userId, session.user.id)),
      )
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file data from storage
    let fileData: Blob;

    if (isLocalStorageMode()) {
      const buffer = await readLocalFile(file.storagePath);
      fileData = new Blob([new Uint8Array(buffer)], { type: file.fileType });
    } else {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.storage
        .from("chatbot-files")
        .download(file.storagePath);

      if (error || !data) {
        throw new Error(`Failed to download file: ${error?.message}`);
      }

      fileData = data;
    }

    // Check if this is a download request (from query param)
    const searchParams = request.nextUrl.searchParams;
    const forceDownload = searchParams.get("download") === "true";

    // Stream the file back to the user
    const headers = new Headers();
    headers.set("Content-Type", file.fileType);
    headers.set("Content-Length", file.fileSize.toString());

    // Set content-disposition based on file type and request
    if (forceDownload || file.fileType !== "application/pdf") {
      // Force download
      headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(file.fileName)}"`,
      );
    } else {
      // Inline view (for PDFs)
      headers.set(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(file.fileName)}"`,
      );
    }

    // Security headers
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "SAMEORIGIN");

    // Cache for 1 hour but require revalidation
    headers.set("Cache-Control", "private, max-age=3600, must-revalidate");

    // Log successful download (in production)
    if (env.NODE_ENV === "production") {
      logInfo("File downloaded", {
        fileId: fileId,
        userId: session.user.id,
        fileName: file.fileName,
        fileSize: file.fileSize,
      });
    }

    return new NextResponse(fileData, {
      status: 200,
      headers,
    });
  } catch (error) {
    const { fileId } = await params;
    logError(error, "File download failed", {
      fileId: fileId,
    });

    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 },
    );
  }
}
