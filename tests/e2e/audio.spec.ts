import { expect, test } from '@playwright/test';
import { fakeMicrophone } from './helpers/fake-microphone';

test.use({ launchOptions: fakeMicrophone('sweep-e2-e4.wav'), permissions: ['microphone'] });

// The tuner only analyses while its panel is on screen (P2 optimisation), so the test keeps it in view.
test('F7: tuner clears on stop and updates within 1 s after reconnect', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs once');
  await page.goto('/');
  const reading = page.locator('.tuner-detail-section .rack-tuner-note-display span');
  await page.locator('.connect-button').click();
  await expect(page.locator('.stop-button')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.tuner-hold-button').click();
  const note = page.locator('.tuner-detail-section .rack-seven-seg strong');
  // Stop on D3. The newly opened fixture starts at E2, so a cached D3 cannot satisfy the reconnect check.
  await expect(note).toHaveText('D', { timeout: 12_000 });

  await page.locator('.stop-button').click();
  await expect(reading).not.toHaveText(/\d+\.\d+ Hz/, { timeout: 2_000 });

  const started = Date.now();
  await page.locator('.connect-button').click();
  await reading.scrollIntoViewIfNeeded(); // the connect button sits at the top of the page
  await expect(note).toHaveText('E', { timeout: 1_000 });
  await expect(reading).toHaveText(/\d+\.\d+ Hz/);
  const elapsed = Date.now() - started;
  await testInfo.attach('f7.json', { body: JSON.stringify({ reconnectToReadingMs: elapsed }), contentType: 'application/json' });
  expect(elapsed).toBeLessThanOrEqual(1_000);
});
