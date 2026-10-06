// Prints the service worker registrations of a persistent Chromium profile,
// signed in with the cookies saved by tests/e2e/auth.setup.ts.
// Usage: node tests/tools/sw-registrations.mjs <baseUrl> <profileDir>
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const [baseUrl, profileDir] = process.argv.slice(2);
const { cookies } = JSON.parse(fs.readFileSync('playwright/.auth/user.json', 'utf8'));

const context = await chromium.launchPersistentContext(profileDir, { headless: true });
await context.addCookies(cookies);
const page = await context.newPage();
await page.goto(`${baseUrl}/`);
await page.waitForLoadState('load');
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.waitForTimeout(3000); // let a pending update install and activate

const registrations = await page.evaluate(async () =>
  (await navigator.serviceWorker.getRegistrations()).map((r) => ({
    scope: r.scope,
    active: r.active?.scriptURL ?? null,
    waiting: r.waiting?.scriptURL ?? null,
  }))
);
console.log(JSON.stringify(registrations, null, 2));
await context.close();
