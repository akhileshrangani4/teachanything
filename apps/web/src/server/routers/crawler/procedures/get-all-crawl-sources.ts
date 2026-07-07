import { protectedProcedure } from "@/server/trpc";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  chatbots,
  crawlSources,
  crawledPages,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { escapeLikePattern } from "@/server/utils";
import { allCrawlSourcesInput } from "../validation";

export const getAllCrawlSourcesProcedure = protectedProcedure
  .input(allCrawlSourcesInput)
  .query(async ({ ctx, input }) => {
    // Build the shared WHERE conditions (owner + search + status filter)
    const conditions: SQL[] = [eq(crawlSources.userId, ctx.session.user.id)];

    if (input.search) {
      const pattern = `%${escapeLikePattern(input.search)}%`;
      const searchCondition = or(
        ilike(crawlSources.rootUrl, pattern),
        sql`${crawlSources.metadata}->>'displayName' ILIKE ${pattern}`,
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    switch (input.status) {
      case "crawling":
        conditions.push(
          inArray(crawlSources.status, ["pending", "discovering", "crawling"]),
        );
        break;
      case "completed":
        conditions.push(eq(crawlSources.status, "completed"));
        break;
      case "failed":
        conditions.push(eq(crawlSources.status, "failed"));
        break;
      case "disabled":
        conditions.push(eq(crawlSources.enabled, false));
        break;
      case "all":
      default:
        break;
    }

    const whereCondition = and(...conditions);

    const [totalCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(crawlSources)
      .where(whereCondition);
    const totalCount = Number(totalCountResult?.count ?? 0);

    // Build ORDER BY. "name" falls back to the root URL when no display name
    // is set so the column sorts the way it renders.
    const dir = input.sortDir === "asc" ? asc : desc;
    const nameExpr = sql`COALESCE(NULLIF(${crawlSources.metadata}->>'displayName', ''), ${crawlSources.rootUrl})`;
    const orderBy =
      input.sortBy === "name"
        ? dir(nameExpr)
        : input.sortBy === "status"
          ? dir(crawlSources.status)
          : input.sortBy === "lastCrawledAt"
            ? dir(crawlSources.lastCrawledAt)
            : dir(crawlSources.createdAt);

    const sources = await ctx.db
      .select({
        id: crawlSources.id,
        rootUrl: crawlSources.rootUrl,
        status: crawlSources.status,
        enabled: crawlSources.enabled,
        lastCrawledAt: crawlSources.lastCrawledAt,
        metadata: crawlSources.metadata,
        createdAt: crawlSources.createdAt,
      })
      .from(crawlSources)
      .where(whereCondition)
      // Secondary key keeps pagination stable when the primary key ties.
      .orderBy(orderBy, desc(crawlSources.id))
      .limit(input.limit)
      .offset(input.offset);

    if (sources.length === 0) return { sources: [], totalCount };

    const sourceIds = sources.map((source) => source.id);

    const pageCounts = await ctx.db
      .select({
        crawlSourceId: crawledPages.crawlSourceId,
        count: sql<number>`count(*)`,
      })
      .from(crawledPages)
      .where(inArray(crawledPages.crawlSourceId, sourceIds))
      .groupBy(crawledPages.crawlSourceId);

    const countMap = new Map(
      pageCounts.map((row) => [row.crawlSourceId, Number(row.count)]),
    );

    // Attached chatbots per source (array; may be empty = "Not attached").
    const attachments = await ctx.db
      .select({
        crawlSourceId: chatbotCrawlSourceAssociations.crawlSourceId,
        chatbotId: chatbots.id,
        chatbotName: chatbots.name,
      })
      .from(chatbotCrawlSourceAssociations)
      .innerJoin(
        chatbots,
        eq(chatbots.id, chatbotCrawlSourceAssociations.chatbotId),
      )
      .where(inArray(chatbotCrawlSourceAssociations.crawlSourceId, sourceIds));

    const attachMap = new Map<string, { id: string; name: string }[]>();
    for (const row of attachments) {
      const list = attachMap.get(row.crawlSourceId) ?? [];
      list.push({ id: row.chatbotId, name: row.chatbotName });
      attachMap.set(row.crawlSourceId, list);
    }

    return {
      sources: sources.map((source) => ({
        ...source,
        pageCount: countMap.get(source.id) ?? 0,
        chatbots: attachMap.get(source.id) ?? [],
      })),
      totalCount,
    };
  });
