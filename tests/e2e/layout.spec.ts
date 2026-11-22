import { test } from '@playwright/test';
import { measureLayout, tapHitPoints } from './helpers/measure';

// P0: record only. Values are attached to the report and collected by `npm run e2e:baseline`.
// Later stages turn selected numbers into assertions (see docs/refactoring-design.md §3.6).
test('layout metrics (recorded)', async ({ page }, testInfo) => {
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
});
