import { describe, expect, it } from "vitest";
import { versionCode } from "../../../scripts/sync-app-version.mjs";

describe("app version stamping", () => {
  it("computes the Android version code", () => expect(versionCode("1.4.10")).toBe(10410));
  it("treats a missing patch as 0", () => expect(versionCode("0.1.0")).toBe(100));
});
