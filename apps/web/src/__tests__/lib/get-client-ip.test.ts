/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { getTrustedClientIp } from "@/lib/get-client-ip";

// Minimal Headers-like stub: getTrustedClientIp only calls `.get(name)`.
function mkHeaders(values: Record<string, string | null>): {
  get(name: string): string | null;
} {
  const lower: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(values)) lower[k.toLowerCase()] = v;
  return {
    get(name: string) {
      return lower[name.toLowerCase()] ?? null;
    },
  };
}

describe("getTrustedClientIp", () => {
  it("prefers x-real-ip when present", () => {
    const ip = getTrustedClientIp(
      mkHeaders({
        "x-real-ip": "203.0.113.5",
        "x-forwarded-for": "10.0.0.1, 203.0.113.5",
      }),
    );
    expect(ip).toBe("203.0.113.5");
  });

  it("uses the rightmost (edge-appended) x-forwarded-for hop", () => {
    const ip = getTrustedClientIp(
      mkHeaders({ "x-forwarded-for": "10.0.0.1, 198.51.100.7" }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("ignores a spoofed leftmost x-forwarded-for entry", () => {
    // A caller sets the leftmost entry to a value they control; the
    // trusted edge appends the real peer IP on the right. We must NOT
    // return the attacker-controlled leftmost value.
    const spoofed = "1.1.1.1"; // attacker-chosen
    const realEdge = "198.51.100.7"; // appended by trusted proxy
    const ip = getTrustedClientIp(
      mkHeaders({ "x-forwarded-for": `${spoofed}, ${realEdge}` }),
    );
    expect(ip).toBe(realEdge);
    expect(ip).not.toBe(spoofed);
  });

  it("trims whitespace around the rightmost hop", () => {
    const ip = getTrustedClientIp(
      mkHeaders({ "x-forwarded-for": "10.0.0.1,   198.51.100.7  " }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("handles a single-hop x-forwarded-for", () => {
    const ip = getTrustedClientIp(
      mkHeaders({ "x-forwarded-for": "198.51.100.7" }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("falls back to 'unknown' when no IP headers are present", () => {
    const ip = getTrustedClientIp(mkHeaders({}));
    expect(ip).toBe("unknown");
  });

  it("falls back to 'unknown' when x-forwarded-for is empty/whitespace", () => {
    const ip = getTrustedClientIp(mkHeaders({ "x-forwarded-for": "  ,  " }));
    expect(ip).toBe("unknown");
  });
});
