import { NextRequest, NextResponse } from "next/server";
import { isLocalStorageMode, saveLocalFile } from "@/server/local-storage";
import { requireApprovedUser } from "@/server/api-auth";
import { env, getMaxFileSizeBytes } from "@/lib/env";
import { logWarn } from "@/lib/logger";

/**
 * Local file upload endpoint for development.
 * Accepts PUT requests with raw file body — same interface as Supabase signed URLs.
 * Path segments form the storage path (e.g., /api/local-upload/userId/fileId).
 *
 * This route bypasses the size and type validation that `files.createUploadUrl`
 * applies before handing out a Supabase signed URL, so it enforces its own
 * limits below rather than trusting the client.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // `isLocalStorageMode()` is an absence-of-config check, not an environment
  // check, so a production deploy that is merely missing its Supabase
  // credentials would otherwise leave this endpoint live. Refuse outright in
  // production: writing uploads to the server filesystem is a development
  // affordance, and a misconfigured prod deploy should fail loudly at upload
  // rather than quietly start accepting files it cannot serve.
  if (env.NODE_ENV === "production") {
    logWarn("Local upload attempted in production", {
      localStorageMode: isLocalStorageMode(),
    });
    return NextResponse.json(
      { error: "Local uploads are not available in production" },
      { status: 403 },
    );
  }

  if (!isLocalStorageMode()) {
    return NextResponse.json(
      { error: "Local uploads are disabled when Supabase is configured" },
      { status: 403 },
    );
  }

  // Approved users only, matching the tRPC upload path. A session stays valid
  // after an admin rejects an account, so checking login alone would let a
  // rejected user keep writing to disk.
  const authResult = await requireApprovedUser(request.headers, {
    surface: "local-upload",
  });
  if (!authResult.ok) return authResult.response;
  const user = authResult.user;

  const { path } = await params;

  // Reject path traversal segments
  if (path.some((segment) => segment === ".." || segment === ".")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storagePath = path.join("/");

  // Verify the path starts with the user's ID
  if (!storagePath.startsWith(user.id + "/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cap the body at the same limit the rest of the upload path enforces.
  // Checking Content-Length first rejects an oversized upload before it is
  // buffered; the post-read check catches a missing or lying header, since
  // arrayBuffer() otherwise materializes the whole body in memory.
  const maxBytes = getMaxFileSizeBytes();
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  // Read the file body
  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  const buffer = Buffer.from(arrayBuffer);

  await saveLocalFile(storagePath, buffer);

  return NextResponse.json({ success: true });
}
