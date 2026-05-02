import { z } from "zod";

export const crawlSourceInput = z.object({
  chatbotId: z.string().uuid(),
  rootUrl: z.string().url(),
  crawlDepth: z.number().int().min(1).max(5).default(3),
  maxPages: z.number().int().min(1).max(500).default(100),
  includePatterns: z
    .array(
      z
        .string()
        .max(200)
        .regex(/^[a-zA-Z0-9\-_/.* ]+$/),
    )
    .max(10)
    .default([]),
  excludePatterns: z
    .array(
      z
        .string()
        .max(200)
        .regex(/^[a-zA-Z0-9\-_/.* ]+$/),
    )
    .max(10)
    .default([]),
});

export const manualUrlInput = z.object({
  chatbotId: z.string().uuid(),
  url: z.string().url(),
});

export const crawlSourceIdInput = z.object({
  crawlSourceId: z.string().uuid(),
});

export const renameCrawlSourceInput = z.object({
  crawlSourceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export const crawledPageIdInput = z.object({
  crawledPageId: z.string().uuid(),
});

export const renameCrawledPageInput = z.object({
  crawledPageId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

export const crawledPagesInput = z.object({
  crawlSourceId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const allCrawlSourcesInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
