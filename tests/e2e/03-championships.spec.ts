/**
 * Championships E2E tests
 *
 * 4.1  Navigate to Championships page
 * 4.2  Create a new championship
 * 4.3  Verify it appears in the list
 * 4.4  Navigate to detail page via "View Details"
 * 4.5  Save championshipId to fixture
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

function loadFixture(): Record<string, unknown> {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveFixture(data: Record<string, unknown>): void {
  const existing = loadFixture();
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
}

test.describe('Championships — CRUD', () => {
  test('create championship, view detail, save fixture', async ({ page }) => {
    const championshipName = `E2E Championship ${Date.now()}`;

    // ── 4.1 Navigate to Championships ────────────────────────────────────────
    await page.goto('/championships');
    await expect(page.getByRole('heading', { name: 'Championships', level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // ── 4.2 Create new championship ──────────────────────────────────────────
    await page.getByRole('button', { name: 'New Championship' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5_000 });

    // Name field — label text is "Name * *" (translation "Name *" + extra " *" in JSX)
    await dialog.getByLabel(/name/i).fill(championshipName);

    // Type: CreatableSelect — click to open, type to filter/create, then select or create
    await dialog.getByRole('combobox').nth(0).click();
    await page.keyboard.type('Regional');
    // Wait for either an existing option or the "Create Regional" option
    await page.waitForTimeout(300);
    const regionalOption = page.getByRole('option', { name: /regional/i });
    await regionalOption.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => null);
    const optionVisible = await regionalOption.isVisible().catch(() => false);
    if (optionVisible) {
      await regionalOption.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Gender: shadcn Select (combobox index 1 within dialog)
    await dialog.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Male' }).waitFor({ state: 'visible', timeout: 3_000 });
    await page.getByRole('option', { name: 'Male' }).click();

    // Age Category: shadcn Select (combobox index 2 within dialog)
    await dialog.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: 'Senior' }).waitFor({ state: 'visible', timeout: 3_000 });
    await page.getByRole('option', { name: 'Senior' }).click();

    // Match Format: AsyncSelect (react-select, combobox index 3 within dialog)
    // Wait for options to load (async), then pick a format containing "6x6"
    await dialog.getByRole('combobox').nth(3).click();
    // AsyncSelect loads options on open — wait for any 6x6 option to appear
    const formatOption = page.getByRole('option', { name: /6x6/i }).first();
    await formatOption.waitFor({ state: 'visible', timeout: 5_000 });
    await formatOption.click();

    // Season (combobox index 4): leave empty — it's optional

    // Submit
    await page.getByRole('button', { name: 'Create Championship' }).click();

    // Wait for dialog to close — this indicates successful creation
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 });

    // Optionally confirm toast (aria-live may duplicate, use .first())
    // Toast title: "Championship created"
    await expect(page.getByText('Championship created').first()).toBeVisible({ timeout: 5_000 });

    // ── 4.3 Verify it appears in the list ───────────────────────────────────
    // The list renders cards grouped by season then format; our new championship
    // will appear under "Unknown Season" since no season was selected.
    await expect(page.getByText(championshipName).first()).toBeVisible({ timeout: 10_000 });

    // ── 4.4 Navigate to detail page via "View Details" ───────────────────────
    // Navigate to detail: find the card containing this championship, click its View Details link
    await page
      .locator('[class*="flex-col"]')
      .filter({ hasText: championshipName })
      .getByRole('link', { name: 'View Details' })
      .click();

    await page.waitForURL(/\/championships\/[a-f0-9-]+/, { timeout: 10_000 });

    // Extract championship ID from URL
    const url = page.url();
    const urlMatch = url.match(/\/championships\/([a-f0-9-]+)/);
    const championshipId = urlMatch ? urlMatch[1] : '';
    expect(championshipId, 'Could not extract championshipId from URL').toBeTruthy();

    // Verify detail page content
    await expect(page.getByText(championshipName).first()).toBeVisible({ timeout: 5_000 });

    // ── 4.5 Save fixture ─────────────────────────────────────────────────────
    saveFixture({ championshipId, championshipName });
  });
});
