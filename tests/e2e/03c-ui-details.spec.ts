/**
 * UI details that Tailwind 4 / react-day-picker 10 changed and screenshots
 * don't pin down.
 */
import { test, expect, type Locator } from '@playwright/test';

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
  await page.waitForTimeout(500); // day buttons animate colour changes (transition-colors)
  expect(await textContrast(middleDay)).toBeGreaterThanOrEqual(3);
});

test('buttons show a pointer cursor', async ({ page }) => {
  await page.goto('/matches');
  const newMatch = page.getByRole('button', { name: 'New Match' });
  await expect(newMatch).toBeVisible({ timeout: 30_000 });
  expect(await newMatch.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
});
