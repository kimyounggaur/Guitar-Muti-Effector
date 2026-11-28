import { expect, test } from '@playwright/test';

test('F1: a left-only stereo input plays equally through both outputs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'audio routing is independent of screen size');
  await page.goto('http://localhost:5174/tests/engine-probe.html');
  await page.getByRole('button', { name: '검사 시작' }).click();
  const result = page.getByRole('status');
  await expect(result).toContainText('통과', { timeout: 15_000 });

  const measurements = await result.getAttribute('data-left-only');
  expect(measurements).toBeTruthy();
  await testInfo.attach('f1-stereo-rms.json', { body: measurements!, contentType: 'application/json' });
  const { leftInput, silentInput } = JSON.parse(measurements!) as { leftInput: number[]; silentInput: number[] };

  expect(leftInput).toHaveLength(2);
  for (const rms of leftInput) expect(rms, 'tone audible on each output').toBeGreaterThan(0.04);
  expect(Math.abs(20 * Math.log10(leftInput[0] / leftInput[1])), 'output imbalance in dB').toBeLessThan(0.2);
  expect(silentInput).toHaveLength(2);
  for (const rms of silentInput) expect(rms, 'selecting the silent input mutes each output').toBeLessThan(0.0001);
});
