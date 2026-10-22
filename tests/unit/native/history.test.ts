import { describe, expect, it } from "vitest";
import { canGoBackIn } from "@/lib/native/history";

describe("canGoBackIn", () => {
  it("trusts the Navigation API when present, whatever the history length", () => {
    expect(canGoBackIn({ navigation: { canGoBack: false }, history: { length: 4 } })).toBe(false);
    expect(canGoBackIn({ navigation: { canGoBack: true }, history: { length: 1 } })).toBe(true);
  });
  it("falls back to the history length", () => {
    expect(canGoBackIn({ history: { length: 1 } })).toBe(false);
    expect(canGoBackIn({ history: { length: 2 } })).toBe(true);
    expect(canGoBackIn({ navigation: {}, history: { length: 2 } })).toBe(true);
  });
});
