import { NextRequest, NextResponse } from "next/server";
import { qstashReceiver, verifyQStashSignature } from "@/lib/qstash";
import { logError } from "@/lib/logger";
import {
  processCrawlPage,
  finalizeCrawlSource,
} from "@/lib/crawl-processor";
import { db } from "@teachanything/db";
import { crawledPages } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";

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
        "Crawl page job rejected",
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const { crawledPageId } = JSON.parse(body);
    await processCrawlPage({ crawledPageId });

    const [page] = await db
      .select({ crawlSourceId: crawledPages.crawlSourceId })
      .from(crawledPages)
      .where(eq(crawledPages.id, crawledPageId))
      .limit(1);

    if (page) {
      await finalizeCrawlSource(page.crawlSourceId);
    }

    return NextResponse.json({ success: true, crawledPageId });
  } catch (error) {
    logError(error, "Crawl page job failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
