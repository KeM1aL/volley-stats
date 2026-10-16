import { describe, expect, it } from "vitest";
import { isPublicPath, isSafeRedirectTarget, normalizePath, parseRouteId, requiresConnection, routes } from "@/lib/routes";

const ID = "3f2b8c1e-9d4a-4b6f-8e2a-1c5d7e9f0a1b";

describe("routes", () => {
  it("builds query-param routes, dropping empty params", () => {
    expect(routes.matchLive(ID)).toBe(`/matches/live?id=${ID}`);
    expect(routes.matchStats(ID, { team: "t1", empty: "" })).toBe(`/matches/stats?id=${ID}&team=t1`);
    expect(routes.teamPlayers(ID)).toBe(`/teams/players?id=${ID}`);
    expect(routes.championship(ID)).toBe(`/championships/view?id=${ID}`);
    expect(routes.signIn("/teams?x=1")).toBe("/auth?redirectTo=%2Fteams%3Fx%3D1");
    expect(routes.signIn()).toBe("/auth");
  });
  it("normalizes trailing slashes", () => {
    expect(normalizePath("/matches/live/")).toBe("/matches/live");
    expect(normalizePath("/")).toBe("/");
  });
  it("knows the public paths", () => {
    for (const p of ["/", "/auth", "/auth/confirm", "/auth/reset-password/", "/matches/stats", "/matches/stats/"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/matches", "/matches/live", "/teams", "/settings", "/authx"]) expect(isPublicPath(p)).toBe(false);
  });
  it("accepts only in-app redirect targets", () => {
    expect(isSafeRedirectTarget("/teams/players?id=1")).toBe(true);
    for (const t of [null, "", "//evil.com", "https://evil.com", "/auth", "/auth/confirm", "/api/v1/x", "/_next/x", "/icon.png", "teams"]) {
      expect(isSafeRedirectTarget(t)).toBe(false);
    }
  });
  it("rejects backslash and control-character tricks browsers turn into //host", () => {
    for (const t of ["/\\evil.com","/\t/evil.com", "/\tevil.com", "/\r/evil.com", "/\n/evil.com"]) {
      expect(isSafeRedirectTarget(t)).toBe(false);
    }
    expect(isSafeRedirectTarget("/teams?x=%5C")).toBe(true);
    expect(isSafeRedirectTarget("/%5Cevil.com")).toBe(true);
  });
  it("knows the screens that need a connection", () => {
    for (const p of [
      "/matches",
      "/matches/",
      "/teams",
      "/teams/",
      "/teams/new",
      "/teams/view",
      "/teams/view/",
      "/teams/players",
      "/championships",
      "/championships/view",
      "/championships/view/",
    ]) {
      expect(requiresConnection(p), p).toBe(true);
    }
    for (const p of [
      "/",
      "/auth",
      "/auth/confirm",
      "/auth/reset-password/",
      "/matches/live",
      "/matches/live/",
      "/matches/score",
      "/matches/stats",
      "/settings",
      "/keyboard-test",
      "/teamsx",
      "/matches/other",
    ]) {
      expect(requiresConnection(p), p).toBe(false);
    }
  });
  it("parses route ids", () => {
    expect(parseRouteId(ID)).toBe(ID);
    expect(parseRouteId(ID.toUpperCase())).toBe(ID);
    for (const v of [null, undefined, "", "abc", `${ID}x`]) expect(parseRouteId(v)).toBeNull();
  });
});
