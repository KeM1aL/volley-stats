import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Fail fast with a clear message if test credentials are not configured.
  // Copy .env.test.example to .env.test.local (or .env.test) and fill in credentials.
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
    throw new Error(
      'Missing TEST_EMAIL or TEST_PASSWORD. Copy .env.test.example to .env.test.local and fill in your credentials.'
    );
  }

  // Ensure the auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/auth');

  // Wait for the sign-in form to be ready before interacting
  await page.getByLabel('Email').waitFor({ state: 'visible', timeout: 15_000 });

  // Fill email
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL);

  // Fill password
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD);

  // Sign in
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect away from /auth (successful login).
  // Use expect-based polling — more resilient than waitForFunction when
  // Next.js client-side navigation resets the JS evaluation context.
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });

  // English UI for every spec: an explicit ?lang= is saved on this device and is never replaced by the profile language.
  await page.goto('/?lang=en');
  await expect(page).toHaveURL((url) => !url.searchParams.has('lang'));
  // The profile is loaded: the device now counts as having adopted it, so later pages keep English.
  await page.waitForFunction(() => localStorage.getItem('volleystats:locale-user') !== null);

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
