import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { qstashReceiver, verifyQStashSignature } from "@/server/qstash";
import { logError } from "@/lib/logger";
import { processFile } from "@/server/file-processor";

/**
 * Embedding a document is the slowest stage of the pipeline and the one that
 * dominates wall-clock time, so this job needs the same ceiling the crawl jobs
 * already declare. Without it the route ran on the platform default -- an order
 * of magnitude shorter -- and any file big enough to need more than a couple of
 * embedding batches was killed mid-run, which the student sees as a file that
 * sticks at 40% and then fails.
 */
export const maxDuration = 300;

const payloadSchema = z.object({ fileId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    // When QStash is not configured, signature verification is impossible
    if (!qstashReceiver) {
      return NextResponse.json(
        {
          error:
            "QStash is not configured — file processing jobs are unavailable",
        },
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

    // Parse job data. Matches the sibling crawl job routes: validate the
    // payload rather than destructuring a bare JSON.parse, so a malformed
    // id is a 400 here instead of an error surfacing from the DB layer.
    const parsed = payloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { fileId } = parsed.data;

    // Process the file using shared function
    const result = await processFile({ fileId });

    return NextResponse.json({
      success: result.success,
      fileId,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    logError(error, "File processing job failed");

    // Do not echo the raw error message to the caller.
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 },
    );
  }
}
