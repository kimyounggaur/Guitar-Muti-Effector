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

// Every pedal's detail panel (desktop width only; the panels share their layout across widths).
const PEDAL_TYPES = ['tuner', 'noiseGate', 'compressor', 'drive', 'ampEQ', 'cabinetIR', 'modulation', 'delay', 'reverb', 'looper', 'rhythm'];
test('each pedal detail panel matches the reference build', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'detail panels are compared once');
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const type of PEDAL_TYPES) {
    await page.locator(`.chain-effect-shell.type-${type} .chain-effect-main`).click();
    const panel = page.locator('.detail-section').first();
    await panel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await expect(panel).toHaveScreenshot(`detail-${type}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixels: 0 });
  }
});
