import { expect, test } from '@playwright/test';
import { renderCounterInitScript } from './helpers/render-counter';

// P1 / P1: which components re-render while connected and idle for 10 s (meters running).
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
});

// InputSafetyNotice is ConnectGuitarPanel's overload indicator (design §2.2 P1: PatchHeader and ConnectGuitarPanel only).
const ALLOWED = new Set(['PatchHeader', 'MeterPill', 'ConnectGuitarPanel', 'InputSafetyNotice']);

test('P1: only meter components re-render while connected', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs once');
  test.setTimeout(60_000);
  await page.addInitScript(renderCounterInitScript);
  await page.goto('http://localhost:5174/'); // development build: readable component names
  await page.locator('.connect-button').click();
  await expect(page.locator('.stop-button')).toBeEnabled({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  await page.evaluate(() => (window as unknown as { __renderCounter: { start(): void } }).__renderCounter.start());
  await page.waitForTimeout(10_000);
  const counts = await page.evaluate(() => (window as unknown as { __renderCounter: { stop(): Record<string, number> } }).__renderCounter.stop());
  await testInfo.attach('renders.json', { body: JSON.stringify(counts, null, 2), contentType: 'application/json' });
  const unexpected = Object.entries(counts).filter(([name, count]) => count > 0 && !ALLOWED.has(name));
  expect(unexpected, JSON.stringify(counts)).toEqual([]);
});
