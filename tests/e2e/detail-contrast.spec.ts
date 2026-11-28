import { expect, test, type Locator } from '@playwright/test';
import { contrastBrowserScript, type Rgba } from './helpers/contrast';

type ContrastHelpers = Pick<typeof import('./helpers/contrast'), 'parseColor' | 'blend' | 'contrastRatio'>;

const pedalTypes = ['tuner', 'noiseGate', 'compressor', 'drive', 'ampEQ', 'cabinetIR', 'modulation', 'delay', 'reverb', 'looper', 'rhythm'] as const;

// Each text owner receives a different test ink. Comparing that ink with black identifies
// the glyph even when adjacent text ranges overlap. A transparent fill reveals its backdrop.
async function measurePaintedText(panel: Locator) {
  await panel.scrollIntoViewIfNeeded();
  const clip = await panel.evaluate((element) => {
    const elements = [element, ...element.querySelectorAll('*')].filter((owner) =>
      owner instanceof HTMLElement && !owner.closest('option,svg') && (
        owner.matches('select,input,textarea') || [...owner.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      ),
    ) as HTMLElement[];
    // Full red encodes antialias coverage. Two channels encode up to 256 different owners.
    if (elements.length > 256) throw new Error('Too many distinct text owners for the painted contrast mask');
    elements.forEach((owner, index) => {
      owner.style.setProperty('--contrast-test-ink', `rgb(255, ${16 * (index % 16) + 8}, ${16 * Math.floor(index / 16) + 8})`);
    });
    const box = element.getBoundingClientRect();
    const x = Math.floor(box.left + window.scrollX), y = Math.floor(box.top + window.scrollY);
    return { x, y, width: Math.ceil(box.right + window.scrollX) - x, height: Math.ceil(box.bottom + window.scrollY) - y };
  });
  const frames: string[] = [];
  for (const fill of ['var(--contrast-test-ink, transparent)', 'black', 'transparent']) {
    const png = await panel.page().screenshot({
      fullPage: true, clip,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      style: `.mobile-control-bar { visibility: hidden !important; }
        .detail-section, .detail-section * { -webkit-text-fill-color: ${fill} !important; }`,
    });
    frames.push(png.toString('base64'));
  }

  return panel.evaluate(async (panel, { frames, clip }) => {
    const { parseColor, blend, contrastRatio } = (window as unknown as { __contrast: ContrastHelpers }).__contrast;

    async function readImage(base64: string) {
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return context.getImageData(0, 0, canvas.width, canvas.height);
    }
    const [ink, black, backing] = await Promise.all(frames.map(readImage));
    if ([black, backing].some((image) => image.width !== ink.width || image.height !== ink.height)) {
      throw new Error('The detail panel resized between contrast samples');
    }
    const origin = { left: clip.x - window.scrollX, top: clip.y - window.scrollY };
    type Failure = { element: string; text: string; ratio: number; at: number[]; foreground: Rgba; background: Rgba };
    const failures: Failure[] = [];
    let measured = 0;

    function measure(element: Element, text: string, boxes: Iterable<DOMRect>) {
      if (!text || element.closest(':disabled,[aria-disabled=true]') ||
          !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
      const style = getComputedStyle(element);
      const ownerInk = parseColor(style.getPropertyValue('--contrast-test-ink'));
      if (!ownerInk) throw new Error(`Missing test ink on ${text}`);
      const foreground = parseColor(style.webkitTextFillColor || style.color);
      if (!foreground) throw new Error(`Unknown text color on ${text}`);
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        foreground[3] *= Number(getComputedStyle(ancestor).opacity);
      }

      let worst = Infinity;
      let sample: { at: number[]; foreground: Rgba; background: Rgba } | undefined;
      for (const box of boxes) {
        const left = Math.max(0, Math.ceil(box.left - origin.left));
        const right = Math.min(ink.width, Math.floor(box.right - origin.left));
        const top = Math.max(0, Math.ceil(box.top - origin.top));
        const bottom = Math.min(ink.height, Math.floor(box.bottom - origin.top));
        for (let y = top; y < bottom; y++) {
          for (let x = left; x < right; x++) {
            const i = 4 * (y * ink.width + x);
            // Discard barely antialiased edges; they are a blend rather than authored text color.
            const coverage = (ink.data[i] - black.data[i]) / 255;
            if (coverage < Math.max(1 / 255, 0.20 * foreground[3])) continue;
            // Subtract the black pass and undo antialias coverage to recover the ink ID.
            const green = (ink.data[i + 1] - black.data[i + 1]) / coverage;
            const blue = (ink.data[i + 2] - black.data[i + 2]) / coverage;
            if (Math.abs(green - ownerInk[1]) >= 8 || Math.abs(blue - ownerInk[2]) >= 8) continue;
            const background: Rgba = [backing.data[i], backing.data[i + 1], backing.data[i + 2], 1];
            const composite = blend(foreground, background);
            const ratio = contrastRatio(composite, background);
            if (ratio < worst) {
              worst = ratio;
              sample = { at: [x, y], foreground: composite, background };
            }
          }
        }
      }
      if (!sample) return; // hidden behind another element, clipped, or no painted glyphs
      measured++;
      if (worst < 4.5) failures.push({ element: element.tagName + '.' + [...element.classList].join('.'), text, ratio: Number(worst.toFixed(3)), ...sample });
    }

    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || element.closest('select,option,textarea,svg')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      measure(element, node.textContent?.trim() ?? '', range.getClientRects());
    }
    // Native controls paint their selected value independently of the option's DOM range.
    for (const control of panel.querySelectorAll<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>(
      'select, textarea, input[type=text], input[type=number], input[type=search]',
    )) {
      const text = control instanceof HTMLSelectElement ? control.selectedOptions[0]?.textContent : control.value;
      measure(control, text?.trim() ?? '', [control.getBoundingClientRect()]);
    }
    return { measured, failures };
  }, { frames, clip });
}

test('active text on each open pedal detail has at least 4.5:1 contrast', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: contrastBrowserScript() });
  for (const type of pedalTypes) {
    await page.locator(`.chain-effect-shell.type-${type} .chain-effect-main`).click();
    const panel = page.locator('.detail-section').first();
    const result = await measurePaintedText(panel);
    await testInfo.attach(`contrast-${type}.json`, { body: JSON.stringify(result), contentType: 'application/json' });
    expect.soft(result.measured, `${type} has measurable text`).toBeGreaterThan(0);
    expect.soft(result.failures, `${type} text over its painted background`).toEqual([]);
  }
});
