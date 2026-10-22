import { describe, expect, it } from "vitest";
import { bootRedirectDecision, bootRedirectTarget, reloadRedirectTarget } from "@/lib/routes";

describe("bootRedirectTarget", () => {
  it("returns an in-app path, auth pages included", () => {
    expect(bootRedirectTarget("?to=%2Fauth%3Faccount-deleted%3D1")).toBe("/auth?account-deleted=1");
    expect(bootRedirectTarget("?to=%2Fteams%2Fview%3Fid%3Dabc")).toBe("/teams/view?id=abc");
  });
  it("rejects missing, external and technical targets", () => {
    for (const search of [
      "",
      "?to=",
      "?to=%2F%2Fevil.com",
      "?to=https%3A%2F%2Fevil.com",
      "?to=%2F%5Cevil.com",
      "?to=%2Fapi%2Fv1%2Fx",
      "?to=%2F_next%2Fx",
      "?to=%2Fteams%0A%2Fx",
    ])
      expect(bootRedirectTarget(search)).toBeNull();
  });
});

describe("reloadRedirectTarget", () => {
  it("keeps the path and query of a sub-page the root HTML was served for", () => {
    expect(reloadRedirectTarget("/teams/", "")).toBe("/teams/");
    expect(reloadRedirectTarget("/auth/", "?account-deleted=1")).toBe("/auth/?account-deleted=1");
    expect(reloadRedirectTarget("/matches/live/", "?id=abc")).toBe("/matches/live/?id=abc");
  });
  it("does nothing on the root page", () => {
    expect(reloadRedirectTarget("/", "")).toBeNull();
    expect(reloadRedirectTarget("/", "?remove-database=1")).toBeNull();
    expect(reloadRedirectTarget("/", "?to=%2Fteams")).toBeNull();
  });
  it("applies the same safety rules as bootRedirectTarget", () => {
    expect(reloadRedirectTarget("/api/v1/x", "")).toBeNull();
    expect(reloadRedirectTarget("/_next/x", "")).toBeNull();
    expect(reloadRedirectTarget("/\\evil.com", "")).toBeNull();
    expect(reloadRedirectTarget("/\\evil.com", "")).toBeNull();
  });
});

describe("bootRedirectDecision", () => {
  const now = 1_000_000;

  it("forwards ?to= on the root path", () => {
    expect(bootRedirectDecision("/", "?to=%2Fteams", null, now)).toEqual({ action: "forward", target: "/teams" });
  });
  it("ignores ?to= on any other path: a reload goes back to that path", () => {
    expect(bootRedirectDecision("/teams/", "?to=%2Fauth", null, now)).toEqual({
      action: "forward",
      target: "/teams/?to=%2Fauth",
    });
  });
  it("reopens a reloaded sub-path and does nothing on a plain root page", () => {
    expect(bootRedirectDecision("/matches/live/", "?id=abc", null, now)).toEqual({ action: "forward", target: "/matches/live/?id=abc" });
    expect(bootRedirectDecision("/", "", null, now)).toEqual({ action: "none" });
    expect(bootRedirectDecision("/", "?to=%2F%2Fevil.com", null, now)).toEqual({ action: "none" });
  });
  it("aborts when the same target was forwarded a moment ago, with or without the trailing slash", () => {
    expect(bootRedirectDecision("/nope/", "", { target: "/nope/", at: now - 500 }, now)).toEqual({ action: "abort" });
    expect(bootRedirectDecision("/nope/", "", { target: "/nope", at: now - 500 }, now)).toEqual({ action: "abort" });
    expect(bootRedirectDecision("/", "?to=%2Fnope", { target: "/nope/", at: now - 500 }, now)).toEqual({ action: "abort" });
  });
  it("forwards again after the window, for another target or another query", () => {
    expect(bootRedirectDecision("/teams/", "", { target: "/teams/", at: now - 6000 }, now)).toEqual({ action: "forward", target: "/teams/" });
    expect(bootRedirectDecision("/teams/", "", { target: "/matches/", at: now - 500 }, now)).toEqual({ action: "forward", target: "/teams/" });
    expect(bootRedirectDecision("/matches/live/", "?id=b", { target: "/matches/live/?id=a", at: now - 500 }, now)).toEqual({
      action: "forward",
      target: "/matches/live/?id=b",
    });
  });
});
