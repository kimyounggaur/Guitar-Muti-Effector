import { expect, test } from '@playwright/test';
import { measureLayout, tapHitPoints } from './helpers/measure';

// P0 recorded these numbers; from P6a the text size, contrast, overflow and TAP checks are assertions.
// Values are still attached to the report so `npm run e2e:baseline` can record them.
test('layout metrics', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('.connect-button').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const metrics = await measureLayout(page);
  const isDesktop = !testInfo.project.name.startsWith('mobile');
  const tap = isDesktop ? await tapHitPoints(page) : null;
  await testInfo.attach('layout.json', {
    body: JSON.stringify({ project: testInfo.project.name, ...metrics, tapHitPoints: tap }, null, 2),
    contentType: 'application/json',
  });

  expect(metrics.textUnder12px, 'text smaller than 12px').toBe(0);
  expect(metrics.lowContrastText, 'text below 4.5:1 contrast').toBe(0);
  expect(metrics.horizontalOverflow, `horizontal overflow ${metrics.overflowPx}px`).toBe(false);
  if (tap) expect(tap).toEqual({ center: true, left: true, right: true, top: true, bottom: true });
});
