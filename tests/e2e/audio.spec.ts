import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

// P1 / F7: tuner after stop and reconnect, with Chrome's fake microphone playing a note sequence.
// (F3 is measured with the real gate worklet in tests/e2e/dsp.spec.ts.)
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${resolve('tests/fixtures/sweep-e2-e4.wav')}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
  permissions: ['microphone'],
});

// FIXME(P1 → P2): after stop and reconnect the tuner keeps showing '신호 없음' although the input meter
// shows signal (reproduced with the fake microphone). F7 is therefore not resolved.
test.fixme('F7: tuner clears on stop and updates within 1 s after reconnect', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs once');
  await page.goto('/');
  const reading = page.locator('.tuner-detail-section .rack-tuner-note-display span');
  await page.locator('.connect-button').click();
  await expect(page.locator('.stop-button')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.tuner-hold-button').click();
  await expect(reading).toHaveText(/\d+\.\d+ Hz/, { timeout: 10_000 });

  await page.locator('.stop-button').click();
  await expect(reading).not.toHaveText(/\d+\.\d+ Hz/, { timeout: 2_000 });

  await page.locator('.connect-button').click();
  const started = Date.now();
  await expect(reading).toHaveText(/\d+\.\d+ Hz/, { timeout: 5_000 });
  const elapsed = Date.now() - started;
  await testInfo.attach('f7.json', { body: JSON.stringify({ reconnectToReadingMs: elapsed }), contentType: 'application/json' });
  expect(elapsed).toBeLessThanOrEqual(1_000);
});
