import { describe, it, expect } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import en from "../../../messages/en.json";

type Node = {
  type: number;
  value?: string;
  options?: Record<string, { value: Node[] }>;
  children?: Node[];
};

// A value left out of `t()` makes ICU show the raw message source to the user.
const CALL =
  /(?:\bt\(\s*|appError\(\s*"[A-Z_]+",\s*)["']([a-zA-Z]+\.[^"'`]+)["']\s*(,|\))/g;
// t(isOpen ? "a.close" : "a.open", { name })
const TERNARY_CALL =
  /\bt\(\s*[^"'`()]+\?\s*["']([a-zA-Z]+\.[^"'`]+)["']\s*:\s*["']([a-zA-Z]+\.[^"'`]+)["']\s*(,|\))/g;
const TRANS = /<Trans\b/g;
const LITERAL = 0;
const POUND = 7;
const TAG = 8;

function argumentNames(ast: Node[], acc = new Set<string>()): Set<string> {
  for (const el of ast) {
    if (el.type !== LITERAL && el.type !== POUND && el.type !== TAG) {
      acc.add(el.value as string);
    }
    for (const o of Object.values(el.options ?? {})) {
      argumentNames(o.value, acc);
    }
    if (el.children) argumentNames(el.children, acc);
  }
  return acc;
}

function lookup(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    );
}

/** The text up to the parenthesis closing the call whose arguments start at `from`. */
function restOfCall(source: string, from: number): string {
  let depth = 1;
  let i = from;
  let quote = "";
  for (; depth > 0 && i < source.length; i++) {
    const char = source[i]!;
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = "";
    } else if ("\"'`".includes(char)) {
      quote = char;
    } else if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char)) {
      depth--;
    }
  }
  return source.slice(from, i);
}

/** The attributes of the JSX tag starting at `from`, up to its closing `>`. */
function jsxAttributes(source: string, from: number): string {
  let depth = 0;
  let i = from;
  for (; i < source.length; i++) {
    const char = source[i]!;
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (char === ">" && depth === 0) break;
  }
  return source.slice(from, i);
}

/** Whether an object literal passes `name` as a key or a shorthand. */
function passesValue(name: string, args: string): boolean {
  return new RegExp(`[{,]\\s*${name}\\s*[:,}]`).test(args);
}

function namesNeeded(key: string): string[] {
  const message = lookup(key);
  if (typeof message !== "string") return [];
  const ast = new IntlMessageFormat(message, "en").getAst() as Node[];
  return [...argumentNames(ast)];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "__tests__") return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("translated message calls", () => {
  it("pass every value their English message needs", () => {
    const missing: string[] = [];
    let ternaryCalls = 0;
    let transCalls = 0;
    const check = (key: string, next: string, source: string, end: number) => {
      const names = namesNeeded(key);
      if (names.length === 0) return;
      const rest = next === ")" ? "" : restOfCall(source, end);
      // A spread or a variable holding the values cannot be checked here.
      if (rest.includes("...") || /^\s*\w+\s*\)$/.test(rest)) return;
      for (const name of names) {
        if (!passesValue(name, rest)) missing.push(`${key} needs ${name}`);
      }
    };

    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(CALL)) {
        const [text, key, next] = match;
        check(key!, next!, source, match.index + text.length);
      }
      for (const match of source.matchAll(TERNARY_CALL)) {
        const [text, first, second, next] = match;
        ternaryCalls++;
        check(first!, next!, source, match.index + text.length);
        check(second!, next!, source, match.index + text.length);
      }
      for (const match of source.matchAll(TRANS)) {
        const attributes = jsxAttributes(source, match.index);
        const key = /\bi18nKey="([^"]+)"/.exec(attributes)?.[1];
        if (!key || attributes.includes("...")) continue;
        transCalls++;
        for (const name of namesNeeded(key)) {
          if (
            !passesValue(name, attributes) &&
            !new RegExp(`\\b${name}=`).test(attributes)
          ) {
            missing.push(`${key} needs ${name}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
    expect(ternaryCalls).toBeGreaterThan(0);
    expect(transCalls).toBeGreaterThan(0);
  });
});

describe("the scanner", () => {
  it.each([
    ["{ count }", true],
    ["{ count: 1 }", true],
    ["{ total: 2, count: 1 }", true],
    ["{\n  count,\n}", true],
    ["{ total: item.count }", false],
    ["{ total: count }", false],
    ["{ total: count, other: 1 }", false],
  ])("reads %j as passing count: %s", (args, expected) => {
    expect(passesValue("count", args)).toBe(expected);
  });

  it("ignores brackets inside strings when finding the end of a call", () => {
    const source = `"a)", { count: 1 }) + other(`;
    expect(restOfCall(source, 0)).toBe(`"a)", { count: 1 })`);
  });

  it("reads past nested JSX when finding the end of a tag", () => {
    const source = `<Trans components={{ a: <a href="/" /> }} count={1} />`;
    expect(jsxAttributes(source, 0)).toContain("count={1}");
  });
});
