import { test } from '@playwright/test';

// P0: record only. Peak/RMS (after preset trim, before limiter and master) for all 108 factory presets.
const PROBE_URL = 'http://localhost:5174/tests/e2e/harness/preset-probe.html';

test('factory preset output levels (recorded)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'audio probe runs once');
  test.setTimeout(600_000);
  await page.goto(PROBE_URL);
  await page.waitForFunction(() => 'measureFactoryPresets' in window, undefined, { timeout: 60_000 });
  const rows = await page.evaluate(() => (window as unknown as { measureFactoryPresets: () => Promise<unknown[]> }).measureFactoryPresets());
  await testInfo.attach('presets.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
});
