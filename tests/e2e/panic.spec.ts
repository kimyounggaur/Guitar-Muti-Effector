import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

// S3 regression: after PANIC, toggling pedals must not bring sound back.
// Every connection to an AudioContext destination is mirrored into a test analyser, so the
// output level is measured where the app's audio leaves the page.
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

test('S3: pedal toggles after PANIC keep the output at or below -90 dBFS', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs once');
  await page.addInitScript(() => {
    const taps: { context: BaseAudioContext; analyser: AnalyserNode }[] = [];
    (window as unknown as { __outputTaps: typeof taps }).__outputTaps = taps;
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      const result = connect.apply(this, args);
      const target = args[0];
      if (target instanceof AudioDestinationNode) {
        let tap = taps.find((item) => item.context === this.context);
        if (!tap) {
          const analyser = this.context.createAnalyser();
          analyser.fftSize = 2048;
          tap = { context: this.context, analyser };
          taps.push(tap);
        }
        connect.call(this, tap.analyser);
      }
      return result;
    } as typeof AudioNode.prototype.connect;
  });
  const outputDb = () =>
    page.evaluate(() => {
      const taps = (window as unknown as { __outputTaps: { context: BaseAudioContext; analyser: AnalyserNode }[] }).__outputTaps;
      let loudest = -Infinity;
      for (const { context, analyser } of taps) {
        if (context.state !== 'running') continue; // a closed or suspended context outputs nothing
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        loudest = Math.max(loudest, 20 * Math.log10(rms || 1e-12));
      }
      return loudest;
    });

  await page.goto('/');
  await page.locator('.connect-button').click();
  await expect(page.locator('.stop-button')).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: '이펙트', exact: true }).click();
  const firstSwitch = page.locator('.hardware-footswitch.is-effect-assigned').first();
  await firstSwitch.click();
  await page.waitForTimeout(800);
  const before = await outputDb();

  await page.locator('.panic-button').click();
  await firstSwitch.click();
  await page.waitForTimeout(300);
  await firstSwitch.click();
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(150);
    samples.push(await outputDb());
  }
  await testInfo.attach('s3.json', { body: JSON.stringify({ beforePanicDb: before, afterPanicDb: samples }), contentType: 'application/json' });
  expect(before, 'the probe hears the app before PANIC').toBeGreaterThan(-90);
  for (const value of samples) expect(value).toBeLessThanOrEqual(-90);
});
