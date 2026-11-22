import { expect, test } from '@playwright/test';

// P1 re-measurements (design §5 step 1): F3, Q1, Q2 rendered with the real effects in OfflineAudioContext.
const PROBE_URL = 'http://localhost:5174/tests/e2e/harness/dsp-probe.html';

test.describe('dsp re-measurement', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'audio probe runs once');
    await page.goto(PROBE_URL);
    await page.waitForFunction(() => 'measureQ2' in window, undefined, { timeout: 60_000 });
  });
  const call = (page: import('@playwright/test').Page, name: string) =>
    page.evaluate((fn) => (window as unknown as Record<string, () => Promise<unknown>>)[fn](), name);

  test('F3: gate at maximum threshold silences -46 dBFS noise to ≤ -80 dBFS', async ({ page }, testInfo) => {
    const rows = (await call(page, 'measureF3')) as Array<{ preset: string; rmsDb: number }>;
    await testInfo.attach('f3.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
    for (const row of rows) expect(row.rmsDb, row.preset).toBeLessThanOrEqual(-80);
  });

  test('Q1: chain noise gain (gate bypassed) ≤ 12 dB', async ({ page }, testInfo) => {
    const rows = (await call(page, 'measureQ1')) as Array<{ preset: string; gainDb: number }>;
    await testInfo.attach('q1.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
    for (const row of rows) expect(row.gainDb, row.preset).toBeLessThanOrEqual(12);
  });

  test('Q2: overdrive 48 keeps ≥ 6 dB dynamics between -40 and -6 dBFS input', async ({ page }, testInfo) => {
    const rows = (await call(page, 'measureQ2')) as Array<{ inputPeakDb: number; outputPeakDb: number }>;
    await testInfo.attach('q2.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });
    expect(rows[2].outputPeakDb - rows[0].outputPeakDb).toBeGreaterThanOrEqual(6);
  });
});
