import { describe, expect, it } from "vitest";
import { browserLocale, initialLocale, profileLocaleToAdopt } from "@/lib/i18n/resolve-locale";
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

describe("splitLocalePrefix", () => {
  it("splits /fr/... and leaves other paths alone", () => {
    expect(splitLocalePrefix("/fr/matches")).toEqual({ locale: "fr", path: "/matches" });
    expect(splitLocalePrefix("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(splitLocalePrefix("/matches")).toBeNull();
    expect(splitLocalePrefix("/french")).toBeNull();
  });
});
