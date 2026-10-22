import { describe, expect, it } from "vitest";
import { backAction } from "@/lib/native/back-action";

const idle = { dialogOpen: false, guardActive: false, canGoBack: false, pathname: "/" };

describe("backAction", () => {
  it("exits while the update page is up, before anything else", () => {
    expect(backAction({ ...idle, blocked: true, canGoBack: true, pathname: "/teams/" })).toBe("exit");
    expect(backAction({ dialogOpen: true, guardActive: true, canGoBack: true, pathname: "/matches/live/", blocked: true })).toBe("exit");
  });
  it("closes a dialog before anything else, even on the live page", () =>
    expect(backAction({ dialogOpen: true, guardActive: true, canGoBack: true, pathname: "/matches/live/" })).toBe("close-dialog"));
  it("asks before leaving a live match", () =>
    expect(backAction({ dialogOpen: false, guardActive: true, canGoBack: true, pathname: "/matches/live/" })).toBe("confirm-leave"));
  it("goes back when the history allows it", () =>
    expect(backAction({ ...idle, canGoBack: true, pathname: "/teams/" })).toBe("back"));
  it("exits from the home page even when the history holds entries", () =>
    expect(backAction({ ...idle, canGoBack: true, pathname: "/" })).toBe("exit"));
  it("still asks before leaving a live match when the history is empty", () =>
    expect(backAction({ ...idle, guardActive: true, pathname: "/matches/live/" })).toBe("confirm-leave"));
  it("exits from the home page and goes home elsewhere", () => {
    expect(backAction({ ...idle, pathname: "/" })).toBe("exit");
    expect(backAction({ ...idle, pathname: "/teams/" })).toBe("home");
  });
});
