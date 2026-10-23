import { describe, expect, it } from "vitest";
import { compareVersions, updateStatus, updateUi } from "@/lib/utils/version";

describe("version check", () => {
  it.each([["1.4.10","1.4.9",1],["1.4","1.4.0",0],["1.0.0","2.0.0",-1],["1.0.0-beta","1.0.0",null],["","1.0.0",null]])
    ("compareVersions(%s, %s)", (a, b, r) => expect(compareVersions(a as string, b as string)).toBe(r));
  it("never blocks without data", () => {
    expect(updateStatus(null, { min_version: "9.0.0", latest_version: "9.0.0" })).toBe("ok");
    expect(updateStatus("1.0.0", null)).toBe("ok");
    expect(updateStatus("1.0.0", { min_version: "x", latest_version: "1.0.0" })).toBe("ok");
  });
  it("asks for an update below min, offers one below latest", () => {
    expect(updateStatus("1.0.0", { min_version: "1.1.0", latest_version: "1.2.0" })).toBe("required");
    expect(updateStatus("1.1.0", { min_version: "1.1.0", latest_version: "1.2.0" })).toBe("available");
  });
  it("waits for the live page to be left before blocking", () => {
    expect(updateUi("required", { onLivePage: true, bannerDismissed: false })).toBe("none");
    expect(updateUi("required", { onLivePage: false, bannerDismissed: true })).toBe("block");
    expect(updateUi("available", { onLivePage: false, bannerDismissed: true })).toBe("none");
  });
  it("never shows the banner over a live match", () => {
    expect(updateUi("available", { onLivePage: true, bannerDismissed: false })).toBe("none");
  });
  it("shows the banner when an update is available and not dismissed", () => {
    expect(updateUi("available", { onLivePage: false, bannerDismissed: false })).toBe("banner");
    expect(updateUi("ok", { onLivePage: false, bannerDismissed: false })).toBe("none");
  });
});
