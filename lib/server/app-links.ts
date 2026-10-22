/** Contents of the files that tie the web origin to the apps (universal links and Android app links). */

export function appleAppSiteAssociation(env: { APPLE_TEAM_ID?: string; IOS_BUNDLE_ID?: string }): object | null {
  const team = env.APPLE_TEAM_ID?.trim();
  const bundle = env.IOS_BUNDLE_ID?.trim();
  if (!team || !bundle) return null;
  return {
    applinks: {
      details: [{ appIDs: [`${team}.${bundle}`], components: [{ "/": "/auth/*" }, { "/": "/matches/*" }] }],
    },
  };
}

export function assetLinks(env: { ANDROID_PACKAGE?: string; ANDROID_CERT_SHA256?: string }): object[] | null {
  const packageName = env.ANDROID_PACKAGE?.trim();
  const fingerprints = (env.ANDROID_CERT_SHA256 ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!packageName || fingerprints.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ];
}
