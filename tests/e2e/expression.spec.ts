import { expect, test } from '@playwright/test';

// P2 / S4-a: the expression pedal is a volume pedal in front of the master, never the master itself.
test('expression pedal leaves the master volume unchanged', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop drag');
  await page.goto('/');
  const pedal = page.getByRole('slider', { name: 'VOLUME 익스프레션' });
  const master = page.locator('.master-status-bar .master-status-item', { hasText: '마스터' }).locator('strong');
  const before = await master.textContent();
  await expect(pedal).toHaveAttribute('aria-valuenow', '100');
  await pedal.scrollIntoViewIfNeeded();
  const box = (await pedal.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  const after = Number(await pedal.getAttribute('aria-valuenow'));
  expect(after).toBeLessThan(100);
  await expect(master).toHaveText(before ?? '');
  await expect(page.locator('.expression-ceiling')).toHaveText(`볼륨 페달 · 마스터 ${(before ?? '').replace('%', '')}% 이하`);
});

test('a single tap on the volume pedal does not change its value (drag only)', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone width');
  await page.goto('/');
  const pedal = page.getByRole('slider', { name: 'VOLUME 익스프레션' });
  await pedal.scrollIntoViewIfNeeded();
  const before = await pedal.getAttribute('aria-valuenow');
  const box = (await pedal.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 6);
  await expect(pedal).toHaveAttribute('aria-valuenow', before ?? '100');
});
