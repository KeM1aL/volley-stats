import { describe, expect, it } from "vitest";
import { appleAppSiteAssociation, assetLinks } from "@/lib/server/app-links";

describe("appleAppSiteAssociation", () => {
  it("lists the app and the link paths", () =>
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: "TEAMID", IOS_BUNDLE_ID: "com.volleystats.app" })).toEqual({
      applinks: { details: [{ appIDs: ["TEAMID.com.volleystats.app"], components: [{ "/": "/auth/*" }, { "/": "/matches/*" }] }] },
    }));
  it("is null with a missing value", () => {
    expect(appleAppSiteAssociation({ IOS_BUNDLE_ID: "com.volleystats.app" })).toBeNull();
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: "TEAMID" })).toBeNull();
    expect(appleAppSiteAssociation({})).toBeNull();
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: "", IOS_BUNDLE_ID: "x" })).toBeNull();
  });
});

describe("assetLinks", () => {
  it("lists the package and the trimmed, non-empty fingerprints", () =>
    expect(assetLinks({ ANDROID_PACKAGE: "com.volleystats.app", ANDROID_CERT_SHA256: "A, B,," })).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.volleystats.app", sha256_cert_fingerprints: ["A", "B"] },
      },
    ]));
  it("is null with a missing value", () => {
    expect(assetLinks({ ANDROID_PACKAGE: "com.volleystats.app" })).toBeNull();
    expect(assetLinks({ ANDROID_CERT_SHA256: "AA" })).toBeNull();
    expect(assetLinks({ ANDROID_PACKAGE: "p", ANDROID_CERT_SHA256: " , " })).toBeNull();
  });
});
