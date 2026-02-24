import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isLocalStorageMode, saveLocalFile } from "@/lib/local-storage";

/**
 * Local file upload endpoint for development.
 * Accepts PUT requests with raw file body — same interface as Supabase signed URLs.
 * Path segments form the storage path (e.g., /api/local-upload/userId/fileId).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!isLocalStorageMode()) {
    return NextResponse.json(
      { error: "Local uploads are disabled when Supabase is configured" },
      { status: 403 },
    );
  }

  // Validate session
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;

  // Reject path traversal segments
  if (path.some((segment) => segment === ".." || segment === ".")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storagePath = path.join("/");

  // Verify the path starts with the user's ID
  if (!storagePath.startsWith(session.user.id + "/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read the file body
  const arrayBuffer = await request.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await saveLocalFile(storagePath, buffer);

  return NextResponse.json({ success: true });
}
