import fs from 'node:fs';
import path from 'node:path';

export const EXPECTED_PAGES = [
  '/', '/auth', '/auth/confirm', '/auth/confirm-email', '/auth/reset-password', '/matches', '/matches/live', '/matches/score',
  '/matches/stats', '/teams', '/teams/new', '/teams/view', '/teams/players', '/championships',
  '/championships/view', '/settings', '/privacy',
];

export function missingPages(outDir, pages = EXPECTED_PAGES) {
  return pages.filter((page) => !fs.existsSync(path.join(outDir, page, 'index.html')));
}

export function forbiddenPaths(relativeFiles) {
  return relativeFiles.filter((file) => {
    const f = file.replaceAll('\\', '/');
    return f.split('/').some((segment) => segment.startsWith('[')) || f.startsWith('serwist/') || f === 'sw.js' || f.startsWith('api/');
  });
}

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{10,}/g;

/** Labels of secrets found in `text` (never the secret itself). */
export function findSecrets(text, { serviceKey } = {}) {
  const found = [];
  for (const match of text.matchAll(JWT)) {
    try {
      if (JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')).role === 'service_role') found.push('service_role JWT');
    } catch {
      // Not a JWT payload.
    }
  }
  for (const _ of text.matchAll(SECRET_KEY)) found.push('sb_secret_ key');
  if (serviceKey && text.includes(serviceKey)) found.push('SUPABASE_SERVICE_ROLE_KEY value');
  return found;
}

export function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}
