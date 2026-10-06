#!/usr/bin/env node
// Summarise an ESLint JSON report as error counts per rule, optionally
// comparing against (or writing) a committed baseline.
// Usage: node scripts/lint-summary.mjs <report.json> [--baseline <file>] [--write <file>]
import fs from 'node:fs';

const [reportPath, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const counts = {};
for (const file of report) {
  for (const message of file.messages) {
    if (message.severity !== 2) continue;
    const rule = message.ruleId ?? '(fatal)';
    counts[rule] = (counts[rule] ?? 0) + 1;
  }
}
const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

const writePath = flag('--write');
if (writePath) {
  fs.writeFileSync(writePath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote baseline to ${writePath}`);
}

const baselinePath = flag('--baseline');
if (!baselinePath) {
  console.log(JSON.stringify(sorted, null, 2));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const regressions = Object.entries(sorted)
  .filter(([rule, count]) => count > (baseline[rule] ?? 0))
  .map(([rule, count]) => `${rule}: ${baseline[rule] ?? 0} -> ${count}`);

if (regressions.length) {
  console.error('New lint errors compared with baseline:\n  ' + regressions.join('\n  '));
  process.exit(1);
}
console.log('No new lint errors compared with baseline.');
