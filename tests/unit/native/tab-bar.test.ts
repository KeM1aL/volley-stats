import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, activeSection, showTabBar, takesTextInput, resizedByKeyboard } from "@/lib/native/tab-bar";

describe("NAV_SECTIONS", () => {
  it("lists the four tabs in order", () =>
    expect(NAV_SECTIONS).toEqual(["/championships", "/matches", "/teams", "/settings"]));
});

describe("activeSection", () => {
  it("maps a detail page to its section", () => {
    expect(activeSection("/teams/view/")).toBe("/teams");
    expect(activeSection("/matches/stats")).toBe("/matches");
    expect(activeSection("/matches/live")).toBe("/matches");
    expect(activeSection("/championships/view")).toBe("/championships");
  });
  it("accepts the section itself, with or without a trailing slash", () => {
    expect(activeSection("/settings/")).toBe("/settings");
    expect(activeSection("/teams")).toBe("/teams");
  });
  it("is null outside the sections", () => {
    expect(activeSection("/")).toBeNull();
    expect(activeSection("/auth")).toBeNull();
    expect(activeSection("/auth/confirm")).toBeNull();
    expect(activeSection("/privacy")).toBeNull();
  });
  it("does not match a path that only starts with a section name", () =>
    expect(activeSection("/teamsx")).toBeNull());
});

describe("showTabBar", () => {
  const app = { nativeApp: true, pathname: "/teams/view", keyboardOpen: false };
  it("shows in the installed app", () => expect(showTabBar(app)).toBe(true));
  it("is hidden on the web and in a browser export", () => expect(showTabBar({ ...app, nativeApp: false })).toBe(false));
  it("is hidden while the keyboard is open", () => expect(showTabBar({ ...app, keyboardOpen: true })).toBe(false));
  it("is hidden on the live match page", () => {
    expect(showTabBar({ ...app, pathname: "/matches/live" })).toBe(false);
    expect(showTabBar({ ...app, pathname: "/matches/live/" })).toBe(false);
  });
  it("is hidden on the sign-in pages", () => {
    expect(showTabBar({ ...app, pathname: "/auth" })).toBe(false);
    expect(showTabBar({ ...app, pathname: "/auth/confirm" })).toBe(false);
  });
  it("shows on the match list and match stats", () => {
    expect(showTabBar({ ...app, pathname: "/matches/" })).toBe(true);
    expect(showTabBar({ ...app, pathname: "/matches/stats" })).toBe(true);
  });
});

describe("takesTextInput", () => {
  it("is true for text fields, areas and editable content", () => {
    expect(takesTextInput({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(takesTextInput({ tagName: "INPUT", type: "password" })).toBe(true);
    expect(takesTextInput({ tagName: "input" })).toBe(true);
    expect(takesTextInput({ tagName: "TEXTAREA" })).toBe(true);
    expect(takesTextInput({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });
  it("is false for controls that open no keyboard", () => {
    expect(takesTextInput({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(takesTextInput({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(takesTextInput({ tagName: "INPUT", type: "submit" })).toBe(false);
    expect(takesTextInput({ tagName: "BUTTON" })).toBe(false);
    expect(takesTextInput({ tagName: "SELECT" })).toBe(false);
  });
});

describe("resizedByKeyboard", () => {
  it("is true when the viewport lost at least 100px", () => expect(resizedByKeyboard(900, 600)).toBe(true));
  it("ignores small changes such as a collapsing address bar", () => expect(resizedByKeyboard(900, 850)).toBe(false));
});
