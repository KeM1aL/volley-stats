import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(process.cwd(), "messages");
const LOCALES = ["en", "fr", "es", "it", "pt"];

/** Keys this branch adds; every language must have them. */
const REQUIRED_KEYS: Record<string, string[]> = {
  "players.json": [
    "archive.action",
    "archive.ariaLabel",
    "archive.confirmTitle",
    "archive.confirmDesc",
    "archive.loseAccess",
    "archive.restoreAriaLabel",
    "archive.showArchived",
    "archive.hideArchived",
    "archive.badge",
    "toast.archived",
    "toast.archivedDesc",
    "toast.restored",
    "toast.restoredDesc",
    "toast.archiveError",
    "toast.restoreError",
  ],
};

const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flatten(child, `${prefix}${key}.`))
    : [prefix.slice(0, -1)];

const keysOf = (locale: string, file: string) =>
  flatten(JSON.parse(fs.readFileSync(path.join(ROOT, locale, file), "utf-8"))).sort();

describe("translations", () => {
  const files = fs.readdirSync(path.join(ROOT, "en")).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    it(`${file} has the same keys in every language`, () => {
      const english = keysOf("en", file);
      for (const locale of LOCALES.slice(1)) expect(keysOf(locale, file), locale).toEqual(english);
    });
  }

  for (const [file, keys] of Object.entries(REQUIRED_KEYS)) {
    it(`${file} has this branch's keys`, () => {
      const english = new Set(keysOf("en", file));
      expect(keys.filter((key) => !english.has(key))).toEqual([]);
    });
  }
});
