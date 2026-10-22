import { describe, expect, it } from "vitest";
import { buildConfirmUrl } from "@/supabase/functions/send-email/_confirm-url";

describe("buildConfirmUrl", () => {
  it("points at /auth/confirm on the redirect's origin, with the redirect's path as next", () => {
    const url = new URL(buildConfirmUrl({ siteUrl: "https://site.example", redirectTo: "https://app.example/settings?tab=1", tokenHash: "abc", type: "email_change" }));
    expect(url.origin).toBe("https://app.example");
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("abc");
    expect(url.searchParams.get("type")).toBe("email_change");
    expect(url.searchParams.get("next")).toBe("/settings?tab=1");
  });
  it("falls back to the site URL and no next when the redirect is missing or invalid", () => {
    for (const redirectTo of ["", "not a url"]) {
      const url = new URL(buildConfirmUrl({ siteUrl: "https://site.example/", redirectTo, tokenHash: "h", type: "signup" }));
      expect(url.origin).toBe("https://site.example");
      expect(url.searchParams.has("next")).toBe(false);
    }
  });
  it("drops the old /auth/callback and locale-prefixed /auth redirects (they are not pages to return to)", () => {
    for (const redirectTo of ["https://app.example/auth/callback?type=recovery", "https://app.example/fr/auth"]) {
      const url = new URL(buildConfirmUrl({ siteUrl: "https://site.example", redirectTo, tokenHash: "h", type: "recovery" }));
      expect(url.searchParams.has("next")).toBe(false);
    }
  });
});
