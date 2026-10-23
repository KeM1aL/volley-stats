#!/usr/bin/env node
// Writes package.json's version into the native projects, so the stores and the minimum-version check see the same number.
//   Android: versionName and versionCode in android/app/build.gradle
//   iOS: MARKETING_VERSION and CURRENT_PROJECT_VERSION (every occurrence) in ios/App/App.xcodeproj/project.pbxproj
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** major * 10000 + minor * 100 + patch. Grows with every release, as the stores require; minor and patch stay below 100 so two versions never share a code. */
export function versionCode(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Version "${version}" is not major.minor.patch (digits only)`);
  const [major, minor, patch] = version.split('.').map(Number);
  if (minor > 99 || patch > 99) throw new Error(`Version "${version}": minor and patch must be 99 or less, or version codes collide`);
  return major * 10000 + minor * 100 + patch;
}

/** Replaces every match; throws when there is none, so a changed native template does not go unnoticed. */
function replaceAll(text, pattern, replacement, file) {
  if (!pattern.test(text)) throw new Error(`${file}: nothing matches ${pattern}`);
  return text.replace(pattern, replacement);
}

export function syncAppVersion(root = process.cwd()) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const code = versionCode(version);

  const gradle = path.join(root, 'android/app/build.gradle');
  let gradleText = fs.readFileSync(gradle, 'utf8');
  gradleText = replaceAll(gradleText, /versionCode\s+\d+/g, `versionCode ${code}`, gradle);
  gradleText = replaceAll(gradleText, /versionName\s+"[^"]*"/g, `versionName "${version}"`, gradle);

  const pbxproj = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
  let pbxText = fs.readFileSync(pbxproj, 'utf8');
  pbxText = replaceAll(pbxText, /MARKETING_VERSION = [^;]*;/g, `MARKETING_VERSION = ${version};`, pbxproj);
  pbxText = replaceAll(pbxText, /CURRENT_PROJECT_VERSION = [^;]*;/g, `CURRENT_PROJECT_VERSION = ${code};`, pbxproj);

  // Both files are computed and checked before either is written, so a failure leaves the projects untouched.
  fs.writeFileSync(gradle, gradleText);
  fs.writeFileSync(pbxproj, pbxText);

  console.log(`App version ${version} (build ${code}) written to the Android and iOS projects.`);
}

// Only when run directly, so the test can import versionCode.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) syncAppVersion();
