import { isServiceAvailable } from "./lib/env";

export function register() {
  const disabled: string[] = [];
  if (!isServiceAvailable("redis")) disabled.push("Rate limiting (no Redis)");
  if (!isServiceAvailable("qstash"))
    disabled.push("Async jobs (no QStash — jobs run inline)");
  if (!isServiceAvailable("resend"))
    disabled.push("Email delivery (no Resend — logged to console)");
  if (!isServiceAvailable("supabase-storage"))
    disabled.push("File storage (no Supabase — using local filesystem)");

  if (disabled.length > 0) {
    console.warn(
      `\nServices disabled for local development:\n${disabled.map((s) => `  - ${s}`).join("\n")}\n`,
    );
  }
}
