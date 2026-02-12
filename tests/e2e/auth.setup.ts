import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Ensure the auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/auth');

  // Fill email
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);

  // Fill password
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);

  // Sign in
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect away from /auth (successful login).
  // Use expect-based polling — more resilient than waitForFunction when
  // Next.js client-side navigation resets the JS evaluation context.
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });

  // Force English locale: navigate via /en/ prefix so the middleware sets
  // the NEXT_LOCALE=en cookie, overriding the user's profile language preference.
  // This ensures all tests run with English UI text regardless of account settings.
  await page.goto('/en/');
  // Use domcontentloaded (not networkidle) — RxDB/Supabase sync runs indefinitely
  // and would make networkidle wait for minutes.
  await page.waitForLoadState('domcontentloaded');

  // Save authenticated state (includes the NEXT_LOCALE=en cookie)
  await page.context().storageState({ path: authFile });
});
