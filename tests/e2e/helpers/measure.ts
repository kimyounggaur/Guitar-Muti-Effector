import type { Page } from '@playwright/test';
import { blend, contrastBrowserScript, contrastRatio, parseColor } from './contrast';

export type LayoutMetrics = {
  viewport: { width: number; height: number };
  pageScreens: number;
  horizontalOverflow: boolean;
  overflowPx: number;
  connectButtonTop: number | null;
  panicButtonTop: number | null;
  textElements: number;
  textUnder11px: number;
  textUnder12px: number;
  minFontSize: number;
  smallTouchTargets: number;
  lowContrastText: number;
  /** First few low-contrast texts, to make a failure readable. */
  lowContrastSamples: string[];
};

/** Measures the page in its current state. Runs inside the browser. */
export async function measureLayout(page: Page): Promise<LayoutMetrics> {
  await page.addScriptTag({ content: contrastBrowserScript() });
  return page.evaluate(() => {
    const helpers = (window as unknown as { __contrast: { parseColor: typeof parseColor; contrastRatio: typeof contrastRatio; blend: typeof blend } }).__contrast;
    const root = document.documentElement;
    const isVisible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const ownText = (el: Element) =>
      Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0);
    const backgroundOf = (el: Element | null) => {
      const layers: ReturnType<typeof helpers.parseColor>[] = [];
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'contents') continue; // draws no box, so no background
        let color = helpers.parseColor(style.backgroundColor);
        // Gradients: approximate with the average of their colour stops.
        const stops = style.backgroundImage.match(/rgba?\([^)]+\)/g);
        if (stops && (!color || color[3] < 1)) {
          const parsed = stops.map((stop) => helpers.parseColor(stop)!).filter(Boolean);
          const avg = [0, 1, 2, 3].map((i) => parsed.reduce((sum, c) => sum + c[i], 0) / parsed.length) as [number, number, number, number];
          color = avg[3] > 0.5 ? [avg[0], avg[1], avg[2], 1] : color;
        }
        if (color && color[3] > 0) {
          layers.push(color);
          if (color[3] >= 1) break;
        }
      }
      let result: [number, number, number, number] = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) result = helpers.blend(layers[i]!, result);
      return result;
    };
    const elements = Array.from(document.body.querySelectorAll('*')).filter((el) => ownText(el) && isVisible(el));
    let under11 = 0;
    let under12 = 0;
    let minFont = Infinity;
    let lowContrast = 0;
    const lowContrastSamples: string[] = [];
    for (const el of elements) {
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      if (size === 0) continue; // visually hidden text
      minFont = Math.min(minFont, size);
      if (size < 11) under11++;
      if (size < 12) under12++;
      const fg = helpers.parseColor(style.color);
      if (fg) {
        const bg = backgroundOf(el);
        const ratio = helpers.contrastRatio(helpers.blend(fg, bg), bg);
        if (ratio < 4.5) {
          lowContrast++;
          if (lowContrastSamples.length < 5) lowContrastSamples.push(`${el.tagName.toLowerCase()}.${el.className} "${(el.textContent ?? '').trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
        }
      }
    }
    const targets = Array.from(document.querySelectorAll('button, [role=slider], a, input, select, summary')).filter(isVisible);
    const smallTouchTargets = targets.filter((el) => {
      if ((el as HTMLInputElement).type === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length;
    const topRatio = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      return Math.round(((el.getBoundingClientRect().top + window.scrollY) / window.innerHeight) * 100) / 100;
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pageScreens: Math.round((root.scrollHeight / window.innerHeight) * 10) / 10,
      horizontalOverflow: root.scrollWidth > root.clientWidth,
      overflowPx: root.scrollWidth - root.clientWidth,
      connectButtonTop: topRatio('.connect-button'),
      panicButtonTop: topRatio('.panic-button'),
      textElements: elements.length,
      textUnder11px: under11,
      textUnder12px: under12,
      minFontSize: Number.isFinite(minFont) ? minFont : 0,
      smallTouchTargets,
      lowContrastText: lowContrast,
      lowContrastSamples,
    };
  });
}

/** Checks that TAP receives clicks at its centre and four inner edge points. */
export async function tapHitPoints(page: Page) {
  const tap = page.locator('.tap-button');
  await tap.scrollIntoViewIfNeeded();
  return tap.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const inset = 4;
    const points = {
      center: [rect.left + rect.width / 2, rect.top + rect.height / 2],
      left: [rect.left + inset, rect.top + rect.height / 2],
      right: [rect.right - inset, rect.top + rect.height / 2],
      top: [rect.left + rect.width / 2, rect.top + inset],
      bottom: [rect.left + rect.width / 2, rect.bottom - inset],
    } as const;
    return Object.fromEntries(
      Object.entries(points).map(([name, [x, y]]) => {
        const hit = document.elementFromPoint(x, y);
        return [name, Boolean(hit && (hit === button || button.contains(hit)))];
      }),
    ) as Record<keyof typeof points, boolean>;
  });
}
