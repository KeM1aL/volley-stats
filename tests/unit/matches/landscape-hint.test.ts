import { describe, expect, it } from "vitest";
import { landscapeHintKey, shouldShowLandscapeHint } from "@/lib/matches/landscape-hint";

describe("shouldShowLandscapeHint", () => {
  const cases: Array<[boolean, boolean, boolean]> = [];
  for (const portrait of [true, false]) {
    for (const coarsePointer of [true, false]) {
      for (const dismissed of [true, false]) cases.push([portrait, coarsePointer, dismissed]);
    }
  }

  it.each(cases)("portrait=%s coarsePointer=%s dismissed=%s", (portrait, coarsePointer, dismissed) => {
    const expected = portrait && coarsePointer && !dismissed;
    expect(shouldShowLandscapeHint({ portrait, coarsePointer, dismissed })).toBe(expected);
  });

  it("is true only for portrait, touch and not dismissed", () => {
    expect(cases.filter(([p, c, d]) => shouldShowLandscapeHint({ portrait: p, coarsePointer: c, dismissed: d }))).toEqual([
      [true, true, false],
    ]);
  });
});

describe("landscapeHintKey", () => {
  it("is per match", () => {
    expect(landscapeHintKey("abc")).toBe("volleystats:landscape-hint-dismissed:abc");
    expect(landscapeHintKey("abc")).not.toBe(landscapeHintKey("def"));
  });
});
