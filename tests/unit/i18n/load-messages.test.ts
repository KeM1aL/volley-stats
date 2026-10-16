import { afterEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/i18n/config";
import { loadMessagesWithFallback } from "@/lib/i18n/load-messages";

function loaders(failing: Locale[]): Record<Locale, () => Promise<{ default: string }>> {
  const make = (locale: Locale) => () => (failing.includes(locale) ? Promise.reject(new Error(`chunk ${locale}`)) : Promise.resolve({ default: `messages ${locale}` }));
  return { en: make("en"), fr: make("fr"), es: make("es"), it: make("it"), pt: make("pt") };
}

describe("loadMessagesWithFallback", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the requested locale", async () => {
    expect(await loadMessagesWithFallback(loaders([]), "fr", ["en"])).toEqual({ locale: "fr", messages: "messages fr" });
  });

  it("falls back to English when the requested messages do not load", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadMessagesWithFallback(loaders(["fr"]), "fr", ["en"])).toEqual({ locale: "en", messages: "messages en" });
  });

  it("returns null without fallbacks, so the caller keeps the current language", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadMessagesWithFallback(loaders(["fr"]), "fr", [])).toBeNull();
  });

  it("returns null when even the fallback fails, and never throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await loadMessagesWithFallback(loaders(["fr", "en"]), "fr", ["en"])).toBeNull();
  });

  it("does not try the requested locale twice", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const all = loaders(["en"]);
    const spy = vi.spyOn(all, "en");
    expect(await loadMessagesWithFallback(all, "en", ["en"])).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
