import { describe, expect, it } from "vitest";
import { readUnsentHint, writeUnsentHint } from "@/lib/rxdb/pending-hint";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("unsent changes hint", () => {
  it("round-trips the count", () => {
    const storage = memoryStorage();
    writeUnsentHint(4, storage);
    expect(readUnsentHint(storage)).toBe(4);
  });

  it("reads 0 when nothing was written or storage is unavailable", () => {
    expect(readUnsentHint(memoryStorage())).toBe(0);
    expect(readUnsentHint(null)).toBe(0);
  });
});
