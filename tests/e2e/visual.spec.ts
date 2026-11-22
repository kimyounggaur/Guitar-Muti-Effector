import { expect, test } from '@playwright/test';

// Full-page screenshots for "no visible change" stages (P5a onwards).
// Reference images live in tests/e2e/__screenshots__ and are taken from the main build:
//   git checkout main && npm run e2e:visual -- --update-snapshots   (then switch back and run npm run e2e:visual)
// Font rendering differs between machines, so the comparison runs only on request (VISUAL=1), not in CI.
test.skip(!process.env.VISUAL, 'pixel comparison runs with VISUAL=1 (npm run e2e:visual)');

test('full page matches the reference build', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('full-page.png', { fullPage: true, animations: 'disabled', caret: 'hide', maxDiffPixels: 0 });
});
