import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  eq,
  and,
  sql,
  desc,
  asc,
  ilike,
  like,
  or,
  isNull,
  not,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  userFiles,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { escapeLikePattern } from "@/server/utils";
import { sweepStaleFiles } from "@/lib/file-stale";

// Crawler-sourced userFiles have storagePath set to the page URL.
// Crawled pages are shown as grouped "Web Sources" rows in the Files tab
// (rendered from crawler.getCrawlSources) rather than cluttering the
// uploaded-file table as individual rows.
// Uploaded files always use a lowercase `{userId}/{fileId}` path, so a
// case-sensitive LIKE is sufficient (and index-friendlier than ILIKE).
const excludeCrawledPages = not(like(userFiles.storagePath, "http%"));

/**
 * List all user files (centralized) with search and sort
 */
export const listProcedure = protectedProcedure
  .input(
    z
      .object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
        search: z.string().max(200).optional(),
        sortBy: z
          .enum([
            "fileName",
            "fileType",
            "fileSize",
            "processingStatus",
            "createdAt",
          ])
          .default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        currentChatbotId: z.string().uuid().optional(),
      })
      .optional(),
  )
  .query(async ({ ctx, input }) => {
    // Settle abandoned processing runs before reading so a dead worker can't
    // leave a file spinning at 40% forever (see sweepStaleFiles).
    await sweepStaleFiles({ db: ctx.db, userId: ctx.session.user.id });

    const limit = input?.limit ?? 10;
    const offset = input?.offset ?? 0;
    const currentChatbotId = input?.currentChatbotId;

    // Build search condition (escape LIKE wildcards for literal matching)
    const searchCondition = input?.search
      ? or(
          ilike(userFiles.fileName, `%${escapeLikePattern(input.search)}%`),
          ilike(userFiles.fileType, `%${escapeLikePattern(input.search)}%`),
        )
      : undefined;

    // Build sort order
    const sortColumn =
      input?.sortBy === "fileName"
        ? userFiles.fileName
        : input?.sortBy === "fileType"
          ? userFiles.fileType
          : input?.sortBy === "fileSize"
            ? userFiles.fileSize
            : input?.sortBy === "processingStatus"
              ? userFiles.processingStatus
              : userFiles.createdAt;
    const orderBy =
      input?.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Build WHERE conditions - base + search + optional exclusion.
    // excludeCrawledPages keeps crawler-sourced files (storagePath = URL) out of
    // the uploaded-files table; they're shown as grouped Web Sources rows.
    const baseConditions = [
      eq(userFiles.userId, ctx.session.user.id),
      excludeCrawledPages,
    ];
    if (searchCondition) baseConditions.push(searchCondition);

    // Validate chatbot ownership before using it for exclusion
    let validatedChatbotId: string | undefined;
    if (currentChatbotId) {
      const [chatbot] = await ctx.db
        .select({ id: chatbots.id })
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, currentChatbotId),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (chatbot) validatedChatbotId = chatbot.id;
    }

    // When excluding files from a chatbot, use LEFT JOIN anti-pattern
    if (validatedChatbotId) {
      const joinCondition = and(
        eq(chatbotFileAssociations.fileId, userFiles.id),
        eq(chatbotFileAssociations.chatbotId, validatedChatbotId),
      );
      const whereCondition = and(
        ...baseConditions,
        isNull(chatbotFileAssociations.id),
      );

      const [countResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(userFiles)
        .leftJoin(chatbotFileAssociations, joinCondition)
        .where(whereCondition);
      const totalCount = Number(countResult?.count || 0);

      const files = await ctx.db
        .select({
          id: userFiles.id,
          userId: userFiles.userId,
          fileName: userFiles.fileName,
          fileType: userFiles.fileType,
          fileSize: userFiles.fileSize,
          storagePath: userFiles.storagePath,
          processingStatus: userFiles.processingStatus,
          metadata: userFiles.metadata,
          createdAt: userFiles.createdAt,
        })
        .from(userFiles)
        .leftJoin(chatbotFileAssociations, joinCondition)
        .where(whereCondition)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      return {
        files: files.map((f) => ({ ...f, metadata: f.metadata ?? undefined })),
        totalCount,
      };
    }

    // Standard query without exclusion
    const whereCondition = and(...baseConditions);

    const [countResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(userFiles)
      .where(whereCondition);
    const totalCount = Number(countResult?.count || 0);

    const files = await ctx.db
      .select()
      .from(userFiles)
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      files: files.map((f) => ({ ...f, metadata: f.metadata ?? undefined })),
      totalCount,
    };
  });

/**
 * List files associated with a specific chatbot with search and sort
 */
export const listForChatbotProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(10).optional(),
      offset: z.number().min(0).default(0).optional(),
      search: z.string().max(200).optional(),
      sortBy: z
        .enum([
          "fileName",
          "fileType",
          "fileSize",
          "processingStatus",
          "createdAt",
        ])
        .default("createdAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
    }),
  )
  .query(async ({ ctx, input }) => {
    // Settle abandoned processing runs before reading so a dead worker can't
    // leave a file spinning at 40% forever (see sweepStaleFiles).
    await sweepStaleFiles({ db: ctx.db, userId: ctx.session.user.id });

    // Verify chatbot ownership
    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, input.chatbotId),
          eq(chatbots.userId, ctx.session.user.id),
        ),
      )
      .limit(1);

    if (!chatbot) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chatbot not found",
      });
    }

    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;

    // Build search condition
    // Escape LIKE wildcards for literal matching
    const searchCondition = input.search
      ? or(
          ilike(userFiles.fileName, `%${escapeLikePattern(input.search)}%`),
          ilike(userFiles.fileType, `%${escapeLikePattern(input.search)}%`),
        )
      : undefined;

    // Combine with chatbot filter + exclude crawler-sourced files
    // (they're rendered as grouped Web Sources rows instead)
    const whereCondition = searchCondition
      ? and(
          eq(chatbotFileAssociations.chatbotId, input.chatbotId),
          excludeCrawledPages,
          searchCondition,
        )
      : and(
          eq(chatbotFileAssociations.chatbotId, input.chatbotId),
          excludeCrawledPages,
        );

    // Get total count with search filter
    const [totalCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(chatbotFileAssociations)
      .innerJoin(userFiles, eq(chatbotFileAssociations.fileId, userFiles.id))
      .where(whereCondition);

    const totalCount = Number(totalCountResult?.count || 0);

    // Build sort order
    const sortColumn =
      input.sortBy === "fileName"
        ? userFiles.fileName
        : input.sortBy === "fileType"
          ? userFiles.fileType
          : input.sortBy === "fileSize"
            ? userFiles.fileSize
            : input.sortBy === "processingStatus"
              ? userFiles.processingStatus
              : userFiles.createdAt;
    const orderBy =
      input.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    // Get paginated files associated with this chatbot through junction table
    const associatedFiles = await ctx.db
      .select({
        id: userFiles.id,
        userId: userFiles.userId,
        fileName: userFiles.fileName,
        fileType: userFiles.fileType,
        fileSize: userFiles.fileSize,
        storagePath: userFiles.storagePath,
        processingStatus: userFiles.processingStatus,
        metadata: userFiles.metadata,
        createdAt: userFiles.createdAt,
        associationId: chatbotFileAssociations.id,
      })
      .from(chatbotFileAssociations)
      .innerJoin(userFiles, eq(chatbotFileAssociations.fileId, userFiles.id))
      .where(whereCondition)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Convert null metadata to undefined for type consistency
    const filesWithMetadata = associatedFiles.map((file) => ({
      ...file,
      metadata: file.metadata ?? undefined,
    }));

    return {
      files: filesWithMetadata,
      totalCount,
    };
  });
