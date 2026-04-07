import { NextRequest, NextResponse } from "next/server";
import { qstashReceiver, verifyQStashSignature } from "@/lib/qstash";
import { logError } from "@/lib/logger";
import { processCrawlDiscovery } from "@/lib/crawl-processor";

export async function POST(req: NextRequest) {
  try {
    if (!qstashReceiver) {
      return NextResponse.json(
        { error: "QStash is not configured" },
        { status: 503 },
      );
    }

    const signature =
      req.headers.get("Upstash-Signature") ||
      req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 },
      );
    }

    const body = await req.text();
    const requestUrl = new URL(req.url);
    requestUrl.search = "";
    const isValid = await verifyQStashSignature(
      signature,
      body,
      requestUrl.toString(),
    );

    if (!isValid) {
      logError(
        new Error("Invalid QStash signature"),
        "Crawl discover job rejected",
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const { crawlSourceId } = JSON.parse(body);
    await processCrawlDiscovery({ crawlSourceId });

    return NextResponse.json({ success: true, crawlSourceId });
  } catch (error) {
    logError(error, "Crawl discover job failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
