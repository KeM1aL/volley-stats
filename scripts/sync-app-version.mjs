#!/usr/bin/env node
// Writes package.json's version into the native projects, so the stores and the minimum-version check see the same number.
//   Android: versionName and versionCode in android/app/build.gradle
//   iOS: MARKETING_VERSION and CURRENT_PROJECT_VERSION (every occurrence) in ios/App/App.xcodeproj/project.pbxproj
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** major * 10000 + minor * 100 + patch (a missing part is 0). Grows with every release, as the stores require. */
export function versionCode(version) {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  return major * 10000 + minor * 100 + patch;
}

/** Replaces every match; throws when there is none, so a changed native template does not go unnoticed. */
function replaceAll(text, pattern, replacement, file) {
  if (!pattern.test(text)) throw new Error(`${file}: nothing matches ${pattern}`);
  return text.replace(pattern, replacement);
}

export function syncAppVersion(root = process.cwd()) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`package.json version "${version}" is not major.minor.patch`);
  const code = versionCode(version);

  const gradle = path.join(root, 'android/app/build.gradle');
  let text = fs.readFileSync(gradle, 'utf8');
  text = replaceAll(text, /versionCode\s+\d+/g, `versionCode ${code}`, gradle);
  text = replaceAll(text, /versionName\s+"[^"]*"/g, `versionName "${version}"`, gradle);
  fs.writeFileSync(gradle, text);

  const pbxproj = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
  text = fs.readFileSync(pbxproj, 'utf8');
  text = replaceAll(text, /MARKETING_VERSION = [^;]*;/g, `MARKETING_VERSION = ${version};`, pbxproj);
  text = replaceAll(text, /CURRENT_PROJECT_VERSION = [^;]*;/g, `CURRENT_PROJECT_VERSION = ${code};`, pbxproj);
  fs.writeFileSync(pbxproj, text);

  console.log(`App version ${version} (build ${code}) written to the Android and iOS projects.`);
}

// Only when run directly, so the test can import versionCode.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) syncAppVersion();
