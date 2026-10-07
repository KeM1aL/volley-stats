#!/usr/bin/env node
// Write the ESLint JSON report used by scripts/lint-summary.mjs.
// Lint errors are expected (they are compared against the baseline), so they
// don't fail this script; an ESLint crash does, and never leaves a stale report.
// Usage: node scripts/lint-report.mjs [output=test-results/lint.json]
import fs from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';

const output = process.argv[2] ?? 'test-results/lint.json';
fs.rmSync(output, { force: true });

const eslint = new ESLint();
const results = await eslint.lintFiles(['.']);
const formatter = await eslint.loadFormatter('json');

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, await formatter.format(results));
console.log(`Wrote ${output}`);
