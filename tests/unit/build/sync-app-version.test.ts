import { describe, expect, it } from "vitest";
import { versionCode } from "../../../scripts/sync-app-version.mjs";

describe("app version stamping", () => {
  it("computes the Android version code", () => {
    expect(versionCode("1.4.10")).toBe(10410);
    expect(versionCode("0.1.0")).toBe(100);
    expect(versionCode("1.99.99")).toBe(19999);
  });
  it("refuses a minor or patch that would collide with another version's code", () => {
    expect(() => versionCode("1.100.0")).toThrow(/99 or less/);
    expect(() => versionCode("1.0.100")).toThrow(/99 or less/);
  });
  it("refuses anything but major.minor.patch digits", () => {
    for (const bad of ["1.4", "1.4.0.1", "1.0.0-beta", "", "a.b.c"]) expect(() => versionCode(bad)).toThrow(/major\.minor\.patch/);
  });
});
