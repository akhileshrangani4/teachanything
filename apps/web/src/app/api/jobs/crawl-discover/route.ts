import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { qstashReceiver, verifyQStashSignature } from "@/server/qstash";
import { logError } from "@/lib/logger";
import { processCrawlDiscovery } from "@/server/crawl-processor";

export const maxDuration = 300;

const payloadSchema = z.object({ crawlSourceId: z.string().uuid() });

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
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const parsed = payloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await processCrawlDiscovery({ crawlSourceId: parsed.data.crawlSourceId });

    return NextResponse.json({
      success: true,
      crawlSourceId: parsed.data.crawlSourceId,
    });
  } catch (error) {
    logError(error, "Crawl discover job failed");
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 },
    );
  }
}
