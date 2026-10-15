#!/usr/bin/env node
// Checks the static export in out/ (or the given folder): every page has an index.html, no server-only
// files, and no secret in any file. Prints file names and labels only, never secret values.
import fs from 'node:fs';
import path from 'node:path';
import { findSecrets, forbiddenPaths, listFiles, missingPages } from './lib/export-check.mjs';

const outDir = path.resolve(process.argv[2] ?? 'out');
if (!fs.existsSync(outDir)) {
  console.error(`No export at ${outDir}: run pnpm build:mobile first.`);
  process.exit(1);
}
const problems = [];
for (const page of missingPages(outDir)) problems.push(`missing page: ${page}/index.html`);
const files = listFiles(outDir);
for (const file of forbiddenPaths(files)) problems.push(`server-only file in the export: ${file}`);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
for (const file of files.filter((f) => /\.(html|js|json|txt|css|map)$/.test(f))) {
  for (const label of findSecrets(fs.readFileSync(path.join(outDir, file), 'utf8'), { serviceKey })) problems.push(`${label} in ${file}`);
}
if (problems.length) {
  console.error('Export check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`Export check passed: ${files.length} files in ${outDir}.`);
