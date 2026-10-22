import { describe, expect, it } from "vitest";
import { adoptionMarkToWrite, browserLocale, initialLocale, profileLocaleToAdopt } from "@/lib/i18n/resolve-locale";
import { splitLocalePrefix } from "@/lib/i18n/locale-path";

describe("initialLocale", () => {
  it("prefers ?lang=, then the stored choice, then the browser, then en", () => {
    expect(initialLocale({ queryLang: "fr", stored: "it", browser: ["es-ES"] })).toBe("fr");
    expect(initialLocale({ queryLang: "xx", stored: "it", browser: ["es-ES"] })).toBe("it");
    expect(initialLocale({ queryLang: null, stored: null, browser: ["de-DE", "pt-BR"] })).toBe("pt");
    expect(initialLocale({ queryLang: null, stored: "zz", browser: ["de"] })).toBe("en");
  });
  it("reads two-letter prefixes case-insensitively", () => {
    expect(browserLocale(["FR-ca"])).toBe("fr");
    expect(browserLocale([])).toBeNull();
  });
});

describe("profileLocaleToAdopt", () => {
  const base = { userId: "u1", adoptedFor: null, explicit: false, profileLanguage: "fr", current: "en" as const };
  it("adopts the profile language once per user on this device", () => {
    expect(profileLocaleToAdopt(base)).toBe("fr");
    expect(profileLocaleToAdopt({ ...base, adoptedFor: "u1" })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, adoptedFor: "u0" })).toBe("fr");
  });
  it("never overrides an explicit choice, and ignores unknown or equal languages", () => {
    expect(profileLocaleToAdopt({ ...base, explicit: true })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, profileLanguage: "de" })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, profileLanguage: "en" })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, userId: null })).toBeNull();
  });
});

describe("adoptionMarkToWrite", () => {
  it("marks the signed-in user as adopted as soon as an explicit ?lang= meets a session, before the profile loads", () => {
    expect(adoptionMarkToWrite({ sessionUserId: "u1", adoptedFor: null, explicit: true })).toBe("u1");
    expect(adoptionMarkToWrite({ sessionUserId: "u1", adoptedFor: "u0", explicit: true })).toBe("u1");
  });
  it("writes nothing without an explicit choice, without a session, or when the mark is already there", () => {
    expect(adoptionMarkToWrite({ sessionUserId: "u1", adoptedFor: null, explicit: false })).toBeNull();
    expect(adoptionMarkToWrite({ sessionUserId: null, adoptedFor: null, explicit: true })).toBeNull();
    expect(adoptionMarkToWrite({ sessionUserId: "u1", adoptedFor: "u1", explicit: true })).toBeNull();
  });
  it("makes the profile language lose on the next page load", () => {
    const base = { userId: "u1", explicit: false, profileLanguage: "fr", current: "en" as const };
    const mark = adoptionMarkToWrite({ sessionUserId: "u1", adoptedFor: null, explicit: true });
    expect(profileLocaleToAdopt({ ...base, adoptedFor: mark })).toBeNull();
  });
});

describe("splitLocalePrefix", () => {
  it("splits /fr/... and leaves other paths alone", () => {
    expect(splitLocalePrefix("/fr/matches")).toEqual({ locale: "fr", path: "/matches" });
    expect(splitLocalePrefix("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(splitLocalePrefix("/matches")).toBeNull();
    expect(splitLocalePrefix("/french")).toBeNull();
  });
});
