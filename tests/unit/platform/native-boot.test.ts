import { describe, expect, it } from "vitest";
import { NATIVE_BOOT_SCRIPT } from "@/lib/platform/native-boot";

type FakeWindow = { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };

/** Runs the boot script against a fake window and document; returns the dataset it left on <html>. */
function run(win: FakeWindow): Record<string, string> {
  const dataset: Record<string, string> = {};
  new Function("window", "document", NATIVE_BOOT_SCRIPT)(win, { documentElement: { dataset } });
  return dataset;
}

describe("NATIVE_BOOT_SCRIPT", () => {
  it("sets the platform on <html> in the iOS app", () => {
    expect(run({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } })).toEqual({ nativeApp: "ios" });
  });

  it("sets the platform on <html> in the Android app", () => {
    expect(run({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } })).toEqual({ nativeApp: "android" });
  });

  it("sets nothing in a browser (Capacitor reports not native)", () => {
    expect(run({ Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" } })).toEqual({});
  });

  it("sets nothing for an unknown platform name", () => {
    expect(run({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "electron" } })).toEqual({});
  });

  it("sets nothing without window.Capacitor", () => {
    expect(run({})).toEqual({});
  });

  it("sets nothing and does not throw when Capacitor throws", () => {
    const throwing = () => {
      throw new Error("boom");
    };
    expect(run({ Capacitor: { isNativePlatform: throwing } })).toEqual({});
    expect(run({ Capacitor: { isNativePlatform: () => true, getPlatform: throwing } })).toEqual({});
  });
});
