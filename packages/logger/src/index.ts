// Simple console-based logger
const isDev = process.env.NODE_ENV === "development";
const LOG_ENABLED = process.env.ENABLE_LOGGING === "true";

export const logger = {
  error: (context: Record<string, unknown>, message: string) => {
    if (LOG_ENABLED) console.error(`[ERROR] ${message}`, context);
  },
  warn: (context: Record<string, unknown>, message: string) => {
    if (LOG_ENABLED) console.warn(`[WARN] ${message}`, context);
  },
  info: (context: Record<string, unknown>, message: string) => {
    if (LOG_ENABLED) console.log(`[INFO] ${message}`, context);
  },
  debug: (context: Record<string, unknown>, message: string) => {
    if (LOG_ENABLED && isDev) console.debug(`[DEBUG] ${message}`, context);
  },
};

/**
 * Log helper with context
 */
export function logWithContext(
  level: "error" | "warn" | "info" | "debug",
  message: string,
  context?: {
    userId?: string;
    chatbotId?: string;
    sessionId?: string;
    fileId?: string;
    [key: string]: unknown;
  },
) {
  if (!LOG_ENABLED) return;
  logger[level](context || {}, message);
}

/**
 * Measure and log execution time of async functions
 */
export async function withTiming<T>(
  fn: () => Promise<T>,
  label: string,
  context?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    if (LOG_ENABLED) {
      const duration = Date.now() - startTime;
      logger.info({ ...context, duration, label }, `${label} completed`);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ ...context, duration, label, error }, `${label} failed`);
    throw error;
  }
}

/**
 * Fields a driver or client attaches to an error alongside `message`.
 *
 * Postgres (via postgres.js) is the one that matters here: `code`, `detail`,
 * `constraint` and friends carry the actual reason a statement failed, and none
 * of it is in `message`.
 */
const CAUSE_FIELDS = [
  "code",
  "detail",
  "hint",
  "constraint",
  "table",
  "column",
  "routine",
  "severity",
] as const;

type CauseInfo = {
  message: string;
  name?: string;
} & Partial<Record<(typeof CAUSE_FIELDS)[number], string>>;

/**
 * Unwrap an error's `cause` chain into something loggable.
 *
 * Wrapper libraries put the real failure here and keep only a summary in
 * `message`. drizzle is the case that bit us: a failing statement arrives as
 * `Failed query: delete from "file_chunks" where ...` with the Postgres error
 * -- the part naming what actually went wrong -- reachable only through
 * `cause`. Logging just `message` turned a one-look diagnosis into a hunt.
 *
 * Depth-capped because a cause chain can be self-referential.
 */
function unwrapCause(error: unknown, depth = 0): CauseInfo[] {
  if (depth > 4 || !error || typeof error !== "object") return [];
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return [];

  const c = cause as Record<string, unknown>;
  const info: CauseInfo = {
    message: c.message?.toString() ?? String(cause),
    name: c.name?.toString(),
  };
  for (const field of CAUSE_FIELDS) {
    if (c[field] !== undefined) info[field] = String(c[field]);
  }
  return [info, ...unwrapCause(cause, depth + 1)];
}

/**
 * Log error with stack trace
 */
export function logError(
  error: Error | unknown,
  message: string,
  context?: Record<string, unknown>,
) {
  // Always log errors
  let errorInfo: {
    message: string;
    stack?: string;
    name?: string;
    details?: unknown;
    causes?: CauseInfo[];
  };

  if (error instanceof Error) {
    // Standard Error object
    errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  } else if (error && typeof error === "object") {
    // Object with error information (e.g., from APIs)
    const errorObj = error as Record<string, unknown>;
    errorInfo = {
      message: errorObj.message?.toString() || JSON.stringify(error),
      name: errorObj.name?.toString() || "Error",
      details: error,
    };
  } else {
    // Primitive value or null/undefined
    errorInfo = {
      message: String(error),
      name: "Error",
    };
  }

  const causes = unwrapCause(error);
  if (causes.length > 0) errorInfo.causes = causes;

  console.error(`[ERROR] ${message}`, {
    ...context,
    error: errorInfo,
  });
}

/**
 * Log info event
 */
export function logInfo(message: string, context?: Record<string, unknown>) {
  if (!LOG_ENABLED) return;
  logger.info(context || {}, message);
}

/**
 * Log debug event
 */
export function logDebug(message: string, context?: Record<string, unknown>) {
  if (!LOG_ENABLED) return;
  logger.debug(context || {}, message);
}

/**
 * Log warning
 */
export function logWarn(message: string, context?: Record<string, unknown>) {
  if (!LOG_ENABLED) return;
  logger.warn(context || {}, message);
}
