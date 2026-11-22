import { expect, test } from '@playwright/test';
import { measureLayout, tapHitPoints } from './helpers/measure';

// P0 recorded these numbers; from P6a the text size, contrast, overflow and TAP checks are assertions.
// Values are still attached to the report so `npm run e2e:baseline` can record them.
test('layout metrics', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('.connect-button').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const metrics = await measureLayout(page);
  const isDesktop = !testInfo.project.name.startsWith('mobile');
  const tap = isDesktop ? await tapHitPoints(page) : null;
  await testInfo.attach('layout.json', {
    body: JSON.stringify({ project: testInfo.project.name, ...metrics, tapHitPoints: tap }, null, 2),
    contentType: 'application/json',
  });

  expect(metrics.textUnder12px, 'text smaller than 12px').toBe(0);
  expect(metrics.lowContrastText, `text below 4.5:1 contrast: ${metrics.lowContrastSamples.join(' | ')}`).toBe(0);
  expect(metrics.horizontalOverflow, `horizontal overflow ${metrics.overflowPx}px`).toBe(false);
  if (tap) expect(tap).toEqual({ center: true, left: true, right: true, top: true, bottom: true });

  // P6c: the phone layout fits in four screens, keeps connect and PANIC in view, and has no touch target under 44px.
  if (!isDesktop) {
    expect(metrics.pageScreens, 'page length in screens').toBeLessThanOrEqual(4);
    expect(await smallTouchTargets(page), 'touch targets under 44px').toEqual([]);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    for (const selector of ['.connect-button', '.panic-button']) {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      expect(box!.y, `${selector} stays in view after scrolling to the end`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${selector} stays in view after scrolling to the end`).toBeLessThanOrEqual(844);
    }
  }
});

function smallTouchTargets(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, summary, [role="slider"], [tabindex="0"]')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden' && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className} ${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)}`),
  );
}
