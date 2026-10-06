/**
 * Dialogs must stay on screen while the virtual keyboard is open.
 * KeyboardContext adds `keyboard-visible` to <body> and sets --keyboard-height;
 * globals.css then nudges dialogs up by half the keyboard height.
 */
import { test, expect } from '@playwright/test';

test('dialog stays on screen when the virtual keyboard is visible', async ({ page }) => {
  await page.goto('/championships');
  await page.getByRole('button', { name: 'New Championship' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5_000 });

  // Emulate the keyboard as KeyboardContext does on a phone.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--keyboard-height', '300px');
    document.body.classList.add('keyboard-visible');
  });
  await page.waitForTimeout(400); // let the transition settle

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box, 'dialog has a bounding box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  // Nudged up: its centre sits above the viewport centre.
  expect(box!.y + box!.height / 2).toBeLessThan(viewport.height / 2);
});
