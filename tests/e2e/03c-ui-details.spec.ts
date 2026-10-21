/**
 * UI details that Tailwind 4 / react-day-picker 10 changed and screenshots
 * don't pin down.
 */
import { test, expect, type Locator } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { routes } from '@/lib/routes';

/** WCAG contrast ratio between an element's text colour and the first opaque background behind it. */
async function textContrast(target: Locator): Promise<number> {
  return target.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css; // normalises oklab()/color-mix()/hsl() to sRGB
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a];
    };
    const luminance = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const fg = rgba(getComputedStyle(el).color);
    let node: Element | null = el;
    let bg: [number, number, number, number] = [255, 255, 255, 255];
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) {
        bg = rgba(c);
        if (bg[3] > 0) break;
      }
      node = node.parentElement;
    }
    const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  });
}

test('days in the middle of a selected date range stay readable', async ({ page }) => {
  await page.goto('/matches');
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.locator('#date').first().click();

  // The filter starts with a "from" date on the 1st; picking the 14th makes a range.
  const firstMonth = page.getByRole('grid').first();
  await firstMonth.getByRole('button', { name: /\b14(th)?\b/ }).first().click();

  const middleDay = firstMonth.getByRole('button', { name: /\b10(th)?\b/ }).first();
  await expect(middleDay).toHaveAttribute('aria-label', /selected/);
  // Day buttons animate colour changes (transition-colors): the contrast of the old colour already passes,
  // so first wait for the transition to end (no running animation and the same colour twice in a row).
  let previousColor = '';
  await expect
    .poll(
      async () => {
        const state = await middleDay.evaluate((el) => ({ animations: el.getAnimations().length, color: getComputedStyle(el).color + getComputedStyle(el).backgroundColor }));
        const settled = state.animations === 0 && state.color === previousColor;
        previousColor = state.color;
        return settled;
      },
      { message: 'the day colour transition ends' }
    )
    .toBe(true);
  expect(await textContrast(middleDay), 'text contrast of a day inside the range').toBeGreaterThanOrEqual(3);
});

test('buttons show a pointer cursor', async ({ page }) => {
  await page.goto('/matches');
  const newMatch = page.getByRole('button', { name: 'New Match' });
  await expect(newMatch).toBeVisible({ timeout: 30_000 });
  expect(await newMatch.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
});

test('team dialog status menu fits on screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const { teamName } = readFixture();
  await page.goto(routes.teams());

  // Find the run's team (the mobile card list shows at this width)
  const searchBox = page.getByPlaceholder('Search by team name...');
  if (!(await searchBox.isVisible())) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(searchBox).toBeVisible({ timeout: 30_000 });
  }
  await searchBox.fill(teamName);
  const card = page.locator('div.border.rounded-lg').filter({ has: page.getByRole('heading', { name: teamName }) });
  await expect(card).toBeVisible({ timeout: 30_000 });
  // Card buttons: 0=View, 1=Players, 2=Edit, 3=Delete
  await card.getByRole('button').nth(2).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const status = dialog.locator('.react-select-container').getByRole('combobox');
  const scrollBefore = await dialog.evaluate((el) => [el.scrollHeight, el.scrollTop]);
  await status.click();

  // The whole menu shows above the dialog, inside the viewport, and its options can be clicked
  const archived = page.getByRole('option', { name: 'Archived' });
  await expect(archived).toBeVisible();
  const box = (await archived.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  // The menu is on top of everything (not clipped by the dialog)...
  expect(await archived.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  // ...and lives outside the dialog's scroll area, which neither grows nor scrolls to make room for it
  await expect(dialog.getByRole('option')).toHaveCount(0);
  expect(await dialog.evaluate((el) => [el.scrollHeight, el.scrollTop])).toEqual(scrollBefore);
  await archived.click();

  // Picking an option doesn't close the dialog
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.react-select-container')).toContainText('Archived');

  // Close without saving
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
});
