import { describe, it, expect } from "@jest/globals";
import { IntlMessageFormat } from "intl-messageformat";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import es from "../../../messages/es.json";
import de from "../../../messages/de.json";
import { createI18n } from "@/i18n/create-i18n";

type Catalog = Record<string, unknown>;
const CATALOGS: Record<string, Catalog> = { fr, es, de };

function leaves(node: Catalog, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of leaves(value as Catalog, path)) out.set(k, v);
  }
  return out;
}

// intl-messageformat AST element types (see @formatjs/icu-messageformat-parser TYPE).
const ARGUMENT = 1,
  NUMBER = 2,
  DATE = 3,
  TIME = 4,
  SELECT = 5,
  PLURAL = 6,
  TAG = 8;
type El = {
  type: number;
  value: string;
  options?: Record<string, { value: El[] }>;
  children?: El[];
};

/** Argument names with their role, and tag names, used anywhere in a message. */
function signature(
  ast: El[],
  acc = new Map<string, string>(),
): Map<string, string> {
  for (const el of ast) {
    if (el.type === ARGUMENT) acc.set(el.value, acc.get(el.value) ?? "string");
    if (el.type === NUMBER || el.type === PLURAL) acc.set(el.value, "number");
    if (el.type === DATE || el.type === TIME) acc.set(el.value, "date");
    if (el.type === SELECT) acc.set(el.value, "select");
    if (el.type === TAG) acc.set(`<${el.value}>`, "tag");
    for (const o of Object.values(el.options ?? {})) signature(o.value, acc);
    if (el.children) signature(el.children, acc);
  }
  return acc;
}

function sampleValues(sig: Map<string, string>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [name, role] of sig) {
    if (role === "tag")
      values[name.slice(1, -1)] = (chunks: string[]) => chunks.join("");
    else
      values[name] =
        role === "number" ? 3 : role === "date" ? new Date(0) : "other";
  }
  return values;
}

const english = leaves(en);

describe.each(Object.keys(CATALOGS))("%s catalog", (locale) => {
  const catalog = leaves(CATALOGS[locale]!);

  it("has exactly the English keys", () => {
    expect([...catalog.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("uses the same arguments and tags as English in every message", () => {
    const mismatches: string[] = [];
    for (const [key, source] of english) {
      const target = catalog.get(key);
      if (!target) continue;
      const a = signature(new IntlMessageFormat(source, "en").getAst() as El[]);
      const b = signature(
        new IntlMessageFormat(target, locale).getAst() as El[],
      );
      if (JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort()))
        mismatches.push(key);
    }
    expect(mismatches).toEqual([]);
  });

  it("formats every message without errors", () => {
    for (const [key, target] of catalog) {
      const fmt = new IntlMessageFormat(target, locale);
      const values = sampleValues(signature(fmt.getAst() as El[]));
      expect(() => fmt.format(values)).not.toThrow();
      expect(key).toBeTruthy();
    }
  });
});

describe("createI18n", () => {
  it("formats ICU plurals in the chosen language", () => {
    const t = createI18n("fr", fr, en).t;
    expect(t("files.deleteDialog.title", { count: 1 })).toBe(
      "Supprimer le fichier",
    );
    expect(t("files.deleteDialog.title", { count: 4 })).toBe(
      "Supprimer 4 fichiers",
    );
  });

  it("formats a progress fraction as a whole percent", () => {
    const format = (locale: "en" | "fr", messages: Catalog) =>
      createI18n(locale, messages).t("files.status.percent", {
        progress: 0.45,
      });
    expect(format("en", en)).toBe("45%");
    expect((format("fr", fr) as string).replace(/[\u00a0\u202f]/g, " ")).toBe(
      "45 %",
    );
  });

  it("falls back to English for a key missing from the translation", () => {
    const partial = { nav: { dashboard: "Tableau de bord" } };
    const t = createI18n("fr", partial, en).t;
    expect(t("nav.dashboard")).toBe("Tableau de bord");
    expect(t("nav.files")).toBe("Files");
  });
});
