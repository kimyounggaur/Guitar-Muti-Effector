import { expect, test, type Page } from '@playwright/test';
import { fakeMicrophone } from './helpers/fake-microphone';

test.use({ launchOptions: fakeMicrophone('noise-48k.wav'), permissions: ['microphone'] });

async function sampleMeters(page: Page) {
  return page.evaluate(async (modulePath) => {
    const { useAudioStore } = await import(modulePath) as typeof import('../../src/store/audioStore');
    const toDb = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-12));
    return new Promise<{ inputDb: number; outputDb: number }>((resolve, reject) => {
      let frames = 0, inputPower = 0, outputPower = 0;
      const timer = window.setTimeout(() => {
        unsubscribe();
        reject(new Error('Live audio meters stopped updating'));
      }, 5000);
      const unsubscribe = useAudioStore.subscribe((state, prev) => {
        if (state.outputMeter === prev.outputMeter) return;
        inputPower += state.inputMeter.rms ** 2;
        outputPower += state.outputMeter.rms ** 2;
        if (++frames < 15) return;
        window.clearTimeout(timer);
        unsubscribe();
        resolve({ inputDb: toDb(Math.sqrt(inputPower / frames)), outputDb: toDb(Math.sqrt(outputPower / frames)) });
      });
    });
  }, '/src/store/audioStore.ts');
}

for (const category of ['클린', '하이 게인']) {
  test(`F3: ${category} gates a live -46 dBFS microphone to ≤ -80 dBFS`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'audio probe runs once');
    // Use the dev server so we can read the actual app meters before the UI floors them at -60 dB.
    await page.goto('http://localhost:5174/');
    await page.locator('.connect-button').click();
    await expect(page.locator('.stop-button')).toBeEnabled();
    await page.locator('.preset-browser-frame summary').click();
    await page.locator('.preset-category-list').getByRole('button', { name: new RegExp(category) }).first().click();
    await page.locator('.preset-title-button').first().click();
    await page.getByRole('button', { name: 'Noise Gate 설정 선택' }).first().click();
    const power = page.locator('.noise-power-slide');
    if (await power.getAttribute('aria-pressed') === 'true') await power.click();

    let bypassed = await sampleMeters(page);
    await expect.poll(async () => (bypassed = await sampleMeters(page)).outputDb).toBeGreaterThan(-100);
    const threshold = page.locator('.noise-rack-fader input');
    await threshold.press('End');
    await expect(threshold).toHaveValue('-10');
    await power.click();
    await expect(page.locator('.noise-rack-module')).toHaveClass(/is-online/);

    let gated = await sampleMeters(page);
    await expect(async () => {
      gated = await sampleMeters(page);
      expect(gated.outputDb).toBeLessThanOrEqual(-80);
      expect(bypassed.outputDb - gated.outputDb).toBeGreaterThan(10);
    }).toPass({ timeout: 8_000 });
    expect(gated.inputDb).toBeGreaterThan(-51);
    expect(gated.inputDb).toBeLessThan(-41);
    await testInfo.attach('f3-live.json', { body: JSON.stringify({ bypassed, gated }), contentType: 'application/json' });
  });
}
