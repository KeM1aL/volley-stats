import { describe, expect, it } from "vitest";
import { appRouteFromUrl } from "@/lib/routes";

const web = "https://app.example";

describe("appRouteFromUrl", () => {
  it.each([
    ["https://app.example/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&team=t", "/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&team=t"],
    ["https://app.example/matches/1B9D6BCD-BBFD-4B2D-9B5D-AB8DFBBD4BED/live?team=x", "/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&team=x"],
    ["https://app.example/teams/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", "/teams/view?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"],
    ["https://app.example/teams/new", "/teams/new"],
    ["https://app.example/auth/confirm?token_hash=abc&type=recovery", "/auth/confirm?token_hash=abc&type=recovery"],
    ["https://evil.example/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", "/"],
    ["not a url", "/"],
  ])("maps %s", (url, route) => expect(appRouteFromUrl(url, web)).toBe(route));

  it("maps every old path form, with a trailing slash too", () => {
    const id = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
    expect(appRouteFromUrl(`https://app.example/matches/${id}/score/`, web)).toBe(`/matches/score?id=${id}`);
    expect(appRouteFromUrl(`https://app.example/matches/${id}/stats`, web)).toBe(`/matches/stats?id=${id}`);
    expect(appRouteFromUrl(`https://app.example/teams/${id}/players`, web)).toBe(`/teams/players?id=${id}`);
    expect(appRouteFromUrl(`https://app.example/championships/${id}`, web)).toBe(`/championships/view?id=${id}`);
  });

  it("compares origins, not prefixes, and accepts a web origin with a path", () => {
    expect(appRouteFromUrl("https://app.example.evil.com/teams/new", web)).toBe("/");
    expect(appRouteFromUrl("http://app.example/teams/new", web)).toBe("/");
    expect(appRouteFromUrl("https://app.example/teams/new", "https://app.example/")).toBe("/teams/new");
  });
});
