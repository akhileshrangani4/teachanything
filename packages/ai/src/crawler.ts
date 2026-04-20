import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import robotsParser from "robots-parser";
import { createHash } from "crypto";
import { resolve4, resolve6 } from "dns/promises";

const USER_AGENT = "TeachAnythingBot/1.0";
const DEFAULT_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_SIZE = 5 * 1024 * 1024;
const MAX_ROBOTS_SIZE = 512 * 1024; // 512KB
const MAX_SITEMAP_SIZE = 10 * 1024 * 1024; // 10MB

export interface CrawlOptions {
  rootUrl: string;
  maxDepth: number;
  maxPages: number;
  includePatterns: string[];
  excludePatterns: string[];
  delayMs?: number;
  signal?: AbortSignal;
}

export interface DiscoveredPage {
  url: string;
  depth: number;
}

export interface PageContent {
  url: string;
  title: string;
  content: string;
  contentHash: string;
  statusCode: number;
  contentType: string;
  wordCount: number;
}

function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";

    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    url.searchParams.sort();

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "ref",
      "fbclid",
      "gclid",
    ];
    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = "";
    }

    const href = url.href;
    return href.endsWith("?") ? href.slice(0, -1) : href;
  } catch {
    return null;
  }
}

function isPrivateIp(ip: string): boolean {
  // Unwrap IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  const mapped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  const ipv4Match = mapped.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const a = parseInt(ipv4Match[1]!, 10);
    const b = parseInt(ipv4Match[2]!, 10);
    if (
      a === 10 || // 10.0.0.0/8
      a === 127 || // 127.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local)
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT / cloud VPCs)
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (benchmarking)
      (a === 192 && b === 0 && parseInt(ipv4Match[3]!, 10) === 0) || // 192.0.0.0/24
      a === 0
    ) {
      return true;
    }
  }

  if (
    mapped === "::1" ||
    mapped === "::" ||
    mapped.startsWith("fe80:") || // link-local
    mapped.startsWith("fc00:") || // unique local
    mapped.startsWith("fd") || // unique local
    mapped.startsWith("64:ff9b:") // NAT64 (may embed private IPv4)
  ) {
    return true;
  }

  return false;
}

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;

    const hostname = parsed.hostname;

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }

    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal"
    ) {
      return false;
    }

    if (isPrivateIp(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function isUrlSafeWithDns(url: string): Promise<boolean> {
  if (!isUrlSafe(url)) return false;

  try {
    const hostname = new URL(url).hostname;

    // For IP literals, validate directly (isUrlSafe already checked but
    // isPrivateIp covers more ranges like 100.64/10)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return !isPrivateIp(hostname);
    }

    const ips: string[] = [];
    try {
      const v4 = await resolve4(hostname);
      ips.push(...v4);
    } catch {
      // no A records
    }
    try {
      const v6 = await resolve6(hostname);
      ips.push(...v6);
    } catch {
      // no AAAA records
    }

    if (ips.length === 0) return false;

    for (const ip of ips) {
      if (isPrivateIp(ip)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isSameDomain(url: string, rootDomain: string): boolean {
  try {
    return new URL(url).hostname === rootDomain;
  } catch {
    return false;
  }
}

function matchesPatterns(
  url: string,
  includePatterns: string[],
  excludePatterns: string[],
): boolean {
  const pathname = new URL(url).pathname;

  if (excludePatterns.length > 0) {
    for (const pattern of excludePatterns) {
      if (matchGlob(pathname, pattern)) return false;
    }
  }

  if (includePatterns.length > 0) {
    for (const pattern of includePatterns) {
      if (matchGlob(pathname, pattern)) return true;
    }
    return false;
  }

  return true;
}

function matchGlob(path: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${regexStr}$`).test(path);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * SSRF-safe fetch: manual redirect following with per-hop DNS validation,
 * body size limits, and configurable timeout.
 */
async function safeFetch(
  url: string,
  opts: {
    maxBodySize?: number;
    timeoutMs?: number;
    acceptContentType?: string;
  } = {},
): Promise<{ response: Response; body: string } | null> {
  const maxBody = opts.maxBodySize ?? MAX_BODY_SIZE;
  const timeoutMs = opts.timeoutMs ?? 10000;
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isUrlSafeWithDns(currentUrl))) return null;

    try {
      const response = await fetch(currentUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      if (opts.acceptContentType) {
        const ct = response.headers.get("content-type") ?? "";
        if (!ct.includes(opts.acceptContentType)) return null;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > maxBody) return null;

      const body = await response.text();
      if (body.length > maxBody) return null;

      return { response, body };
    } catch {
      return null;
    }
  }

  return null;
}

async function fetchRobotsText(rootUrl: string): Promise<string> {
  const robotsUrl = new URL("/robots.txt", rootUrl).href;
  const result = await safeFetch(robotsUrl, { maxBodySize: MAX_ROBOTS_SIZE });
  if (!result || !result.response.ok) return "";
  return result.body;
}

async function fetchRobots(
  rootUrl: string,
): Promise<ReturnType<typeof robotsParser>> {
  const text = await fetchRobotsText(rootUrl);
  return parseRobots(rootUrl, text);
}

function parseRobots(
  rootUrl: string,
  text: string,
): ReturnType<typeof robotsParser> {
  const robotsUrl = new URL("/robots.txt", rootUrl).href;
  return robotsParser(robotsUrl, text);
}

function extractLinks(
  html: string,
  pageUrl: string,
  rootDomain: string,
): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized) return;
    if (!isSameDomain(normalized, rootDomain)) return;

    links.add(normalized);
  });

  return Array.from(links);
}

function extractTextFromNode(
  $: ReturnType<typeof cheerio.load>,
  selector: string,
): string {
  return $(selector)
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .join("\n");
}

function extractContent(
  html: string,
  url: string,
): { title: string; content: string } | null {
  // Strategy 1: Try JSDOM + Readability first (best for article-style pages).
  // Only load cheerio as a fallback to avoid holding both DOMs in memory.
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const title =
      doc.querySelector("title")?.textContent?.trim() ||
      doc.querySelector("h1")?.textContent?.trim() ||
      url;

    doc
      .querySelectorAll("script, style, noscript, iframe, [aria-hidden='true']")
      .forEach((el) => el.remove());

    const reader = new Readability(doc, { charThreshold: 20 });
    const article = reader.parse();

    if (article?.textContent && article.textContent.trim().length > 200) {
      return {
        title: article.title ?? title,
        content: article.textContent.trim(),
      };
    }

    // Readability didn't extract enough -- fall through to cheerio
  } catch {
    // JSDOM failed -- fall through to cheerio
  }

  // Strategy 2: Cheerio-based extraction for non-article pages
  const $ = cheerio.load(html);
  const title =
    $("title").text().trim() || $("h1").first().text().trim() || url;

  $(
    "script, style, noscript, iframe, " +
      "[aria-hidden='true'], .sr-only, .visually-hidden, " +
      "nav, header, footer, aside, " +
      '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
      ".nav, .navbar, .header, .footer, .sidebar, .menu, .cookie-banner, .ad, .advertisement",
  ).remove();

  const sections: string[] = [];
  for (const selector of [
    "h1, h2, h3, h4, h5, h6",
    "p",
    "li",
    "td, th",
    "dt, dd",
  ]) {
    const text = extractTextFromNode($, selector);
    if (text) sections.push(text);
  }

  if (sections.length === 0 || sections.join("").length < 100) {
    const bodyText = $("main, article, [role='main'], body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    if (bodyText.length > 50) return { title, content: bodyText };
    return null;
  }

  return { title, content: sections.join("\n").trim() };
}

const MAX_REDIRECTS = 5;

async function fetchPageSafe(url: string): Promise<{
  html: string;
  statusCode: number;
  contentType: string;
} | null> {
  const result = await safeFetch(url, {
    maxBodySize: MAX_BODY_SIZE,
    timeoutMs: FETCH_TIMEOUT_MS,
    acceptContentType: "text/html",
  });
  if (!result) return null;

  return {
    html: result.body,
    statusCode: result.response.status,
    contentType: result.response.headers.get("content-type") ?? "",
  };
}

async function fetchSitemapUrls(rootUrl: string): Promise<string[]> {
  const sitemapPaths = ["/sitemap.xml", "/sitemap_index.xml"];

  for (const path of sitemapPaths) {
    const sitemapUrl = new URL(path, rootUrl).href;
    const result = await safeFetch(sitemapUrl, {
      maxBodySize: MAX_SITEMAP_SIZE,
    });
    if (!result || !result.response.ok) continue;

    try {
      const $ = cheerio.load(result.body, { xmlMode: true });
      const urls: string[] = [];
      $("url > loc, sitemap > loc").each((_, el) => {
        const url = $(el).text().trim();
        if (url) urls.push(url);
      });
      if (urls.length > 0) return urls;
    } catch {
      continue;
    }
  }
  return [];
}

export async function discoverPages(
  options: CrawlOptions,
): Promise<DiscoveredPage[]> {
  const rootDomain = new URL(options.rootUrl).hostname;
  const robots = await fetchRobots(options.rootUrl);
  const visited = new Set<string>();
  const queue: DiscoveredPage[] = [];
  let queueIndex = 0;
  const discovered: DiscoveredPage[] = [];

  const rootNormalized = normalizeUrl(options.rootUrl, options.rootUrl);
  if (!rootNormalized) return [];

  queue.push({ url: rootNormalized, depth: 0 });
  visited.add(rootNormalized);

  while (queueIndex < queue.length && discovered.length < options.maxPages) {
    if (options.signal?.aborted) break;

    const entry = queue[queueIndex++]!;

    if (!(await isUrlSafeWithDns(entry.url))) continue;

    const isAllowed = robots.isAllowed(entry.url, USER_AGENT);
    if (isAllowed === false) continue;

    if (
      !matchesPatterns(
        entry.url,
        options.includePatterns,
        options.excludePatterns,
      )
    ) {
      continue;
    }

    discovered.push(entry);

    if (entry.depth >= options.maxDepth) continue;

    await delay(options.delayMs ?? DEFAULT_DELAY_MS);

    const result = await fetchPageSafe(entry.url);
    if (!result) continue;

    let links = extractLinks(result.html, entry.url, rootDomain);

    if (links.length === 0 && entry.depth === 0) {
      const sitemapUrls = await fetchSitemapUrls(options.rootUrl);
      links = sitemapUrls
        .map((u) => normalizeUrl(u, options.rootUrl))
        .filter((u): u is string => u !== null && isSameDomain(u, rootDomain));
    }

    for (const link of links) {
      if (
        !visited.has(link) &&
        discovered.length + queue.length < options.maxPages * 2
      ) {
        visited.add(link);
        queue.push({ url: link, depth: entry.depth + 1 });
      }
    }
  }

  return discovered.slice(0, options.maxPages);
}

export async function fetchAndExtractPage(
  url: string,
): Promise<PageContent | null> {
  const result = await fetchPageSafe(url);
  if (!result) return null;

  const extracted = extractContent(result.html, url);
  if (!extracted) return null;

  const contentHash = createHash("sha256")
    .update(extracted.content)
    .digest("hex");

  return {
    url,
    title: extracted.title,
    content: extracted.content,
    contentHash,
    statusCode: result.statusCode,
    contentType: result.contentType,
    wordCount: extracted.content.split(/\s+/).length,
  };
}

export function isRobotsAllowed(
  robots: ReturnType<typeof robotsParser>,
  url: string,
): boolean {
  const result = robots.isAllowed(url, USER_AGENT);
  return result !== false;
}

/**
 * Verify a URL is reachable (HEAD request with SSRF-safe redirect following).
 * Throws an error with a descriptive message on failure.
 */
export async function verifyUrlReachable(url: string): Promise<void> {
  if (!(await isUrlSafeWithDns(url))) {
    throw new Error("URL is not allowed");
  }

  let currentUrl = url;
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isUrlSafeWithDns(currentUrl))) {
      throw new Error("URL is not allowed");
    }
    response = await fetch(currentUrl, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    throw new Error(
      `Could not reach that URL (${response?.status ?? "unknown"}). Please check it's correct and publicly accessible.`,
    );
  }
}

export {
  normalizeUrl,
  isUrlSafe,
  isUrlSafeWithDns,
  isSameDomain,
  fetchRobots,
  fetchRobotsText,
  parseRobots,
  USER_AGENT,
};
