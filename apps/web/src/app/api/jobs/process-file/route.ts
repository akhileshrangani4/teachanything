import { NextRequest, NextResponse } from "next/server";
import { qstashReceiver, verifyQStashSignature } from "@/lib/qstash";
import { logError } from "@/lib/logger";
import { processFile } from "@/lib/file-processor";

export async function POST(req: NextRequest) {
  try {
    // When QStash is not configured, signature verification is impossible
    if (!qstashReceiver) {
      return NextResponse.json(
        { error: "QStash is not configured — file processing jobs are unavailable" },
        { status: 503 },
      );
    }

    // Verify QStash signature
    // Check both header cases (some platforms lowercase headers)
    const signature =
      req.headers.get("Upstash-Signature") ||
      req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const body = await req.text();
    // Use the actual request URL for verification (QStash signs the exact URL it calls)
    // Remove query params if any, as QStash signs the base URL
    const requestUrl = new URL(req.url);
    requestUrl.search = ""; // Remove query params
    const url = requestUrl.toString();
    const isValid = await verifyQStashSignature(signature, body, url);

    if (!isValid) {
      logError(
        new Error("Invalid QStash signature"),
        "File processing job rejected",
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse job data
    const { fileId } = JSON.parse(body);

    // Process the file using shared function
    const result = await processFile({ fileId });

    return NextResponse.json({
      success: result.success,
      fileId,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    logError(error, "File processing job failed");

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
