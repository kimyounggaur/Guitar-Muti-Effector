import { expect, test } from '@playwright/test';
import { renderCounterInitScript } from './helpers/render-counter';

// P1 / P1: which components re-render while connected and idle for 10 s (meters running).
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
});

// InputSafetyNotice is ConnectGuitarPanel's overload indicator (design §2.2 P1: PatchHeader and ConnectGuitarPanel only).
// MobileInputMeter is the input level bar of the phone top bar (P6c).
const ALLOWED = new Set(['PatchHeader', 'MeterPill', 'ConnectGuitarPanel', 'InputSafetyNotice', 'MobileInputMeter']);

test('P1: only meter components re-render while connected', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs once');
  test.setTimeout(60_000);
  await page.addInitScript(renderCounterInitScript);
  await page.goto('http://localhost:5174/tests/e2e/harness/profiler.html'); // development build: readable component names
  await page.locator('.connect-button').click();
  await expect(page.locator('.stop-button')).toBeEnabled({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  const commits = () => page.evaluate(() => (window as unknown as { readProfileCommits(): number }).readProfileCommits());
  const before = await commits();
  await page.evaluate(() => (window as unknown as { __renderCounter: { start(): void } }).__renderCounter.start());
  await page.waitForTimeout(10_000);
  const counts = await page.evaluate(() => (window as unknown as { __renderCounter: { stop(): Record<string, number> } }).__renderCounter.stop());
  expect(await commits() - before, 'React Profiler must receive commits while connected').toBeGreaterThan(0);
  await testInfo.attach('renders.json', { body: JSON.stringify(counts, null, 2), contentType: 'application/json' });
  expect(counts.PatchHeader ?? 0, 'the profiler must observe live meter renders').toBeGreaterThan(0);
  const unexpected = Object.entries(counts).filter(([name, count]) => count > 0 && !ALLOWED.has(name));
  expect(unexpected, JSON.stringify(counts)).toEqual([]);
});
