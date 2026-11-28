// Lists CSS selectors that never match while the built app is driven through its panels (design §3.6, P6b).
// Usage: npm run build && node scripts/css-usage.mjs [--json]
// State pseudo-classes (:hover, :focus, :disabled …), :not() and pseudo-elements are removed before matching,
// so :hover / ::before rules count as used when their element exists. :is() / :where() / :has() are kept.
// A rule inside @media counts only at a width where the media query applies.
import { preview as vitePreview } from 'vite';
import { chromium } from 'playwright';

export const WIDTHS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844, isMobile: true, hasTouch: true },
  // One width inside each range between the media query breakpoints (520/640/767/900/980/1180/1199).
  ...[600, 720, 860, 960, 1100, 1190].map((width) => ({ width, height: 900 })),
];
export const PEDAL_TYPES = ['tuner', 'noiseGate', 'compressor', 'drive', 'ampEQ', 'cabinetIR', 'modulation', 'delay', 'reverb', 'looper', 'rhythm'];

/** Drives the page through the states whose styles must stay, calling record() in each. */
export async function visitStates(page, record) {
  await record('start');
  const selectPedal = async (type) => {
    await page.locator(`.chain-effect-shell.type-${type} .chain-effect-main`).click();
    await page.locator(`.chain-effect-shell.type-${type} .chain-effect-main[aria-pressed="true"]`).waitFor();
  };
  for (const type of PEDAL_TYPES) {
    await selectPedal(type);
    await record(`detail:${type}`);
  }
  await page.getByRole('button', { name: '이펙트', exact: true }).click();
  await record('footswitch:effects');
  const switches = page.locator('.stomp-category-switch');
  // Select concrete switches before toggling: the matched list changes as each turns off.
  const enabledIndices = await switches.evaluateAll((buttons) => buttons.flatMap((button, index) =>
    !button.disabled && button.getAttribute('aria-pressed') === 'true' ? [index] : []));
  if (enabledIndices.length === 0) throw new Error('No enabled footswitches to exercise');
  for (const index of enabledIndices.slice(0, 2)) await switches.nth(index).click();
  await record('footswitch:effects-off');
  for (const index of enabledIndices.slice(0, 2)) await switches.nth(index).click();
  await page.getByRole('button', { name: '프리셋', exact: true }).click();
  await switches.first().click();
  await page.locator('.lcd-preset-grid-view').waitFor();
  await record('lcd:preset-grid');
  await page.getByRole('button', { name: '이펙트 보드', exact: true }).click();

  await page.locator('details.preset-browser-frame').evaluate((details) => { details.open = true; });
  await record('presets-open');
  await page.locator('.preset-category-list button').first().click();
  const preset = page.locator('.preset-card:not(.is-active) .preset-title-button').first();
  await preset.click();
  await record('preset-selected');

  const settings = page.locator('details.mobile-settings > summary');
  if (await settings.isVisible()) {
    await settings.click();
    await record('settings-open');
    await settings.click();
    const player = page.locator('details.audio-file-player > summary');
    await player.click();
    await record('player-open');
    await player.click();
    const safety = page.locator('details.mobile-safety > summary');
    await safety.click();
    await record('safety-open');
    await safety.click();
  }

  await page.locator('.connect-button').click();
  await page.locator('.screen-led.is-live').waitFor({ state: 'attached' });
  await record('connected');
  for (const type of ['tuner', 'looper', 'rhythm']) {
    await selectPedal(type);
    await record(`connected:${type}`);
  }
}

/** Chromium with a fake microphone, so connecting works without a device. */
export function launchBrowser() {
  return chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
}

/** In the page: which of the given selectors match now, honouring each one's media condition. */
export function matchSelectorsInPage(items) {
  const strip = (selector) =>
    selector
      .replace(/::?(before|after|placeholder|selection|marker|backdrop|file-selector-button|first-line|first-letter|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g, '')
      .replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '')
      .replace(/:(hover|focus-visible|focus-within|focus|active|visited|disabled|enabled|checked|indeterminate|placeholder-shown|open|target|default|required|invalid|valid|read-only|autofill|first-child|last-child|first-of-type|last-of-type|only-child|empty|root)\b/g, '')
      .replace(/:nth-[a-z-]+\([^)]*\)/g, '')
      .replace(/:(is|where)\(\s*\)/g, '')
      .trim() || '*';
  return items.map(({ selector, media }) => {
    if (media && !window.matchMedia(media).matches) return false;
    try {
      return document.querySelector(strip(selector)) !== null;
    } catch {
      return true; // a selector the browser cannot parse here is kept
    }
  });
}

/** CSSOM rules of the loaded page as { selector, media } items (one per selector in a list). */
function collectRulesInPage() {
  const items = [];
  const walk = (rules, media) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        for (const selector of rule.selectorText.split(/,(?![^(]*\))/)) items.push({ selector: selector.trim(), media });
      } else if (rule instanceof CSSMediaRule) {
        walk(rule.cssRules, media ? `${media} and ${rule.conditionText}` : rule.conditionText);
      } else if ('cssRules' in rule && rule.cssRules) {
        walk(rule.cssRules, media);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules, ''); } catch { /* cross-origin sheet */ }
  }
  return items;
}

export async function startPreview(port = 4176) {
  const host = '127.0.0.1';
  const server = await vitePreview({ preview: { host, port, strictPort: true }, logLevel: 'error' });
  return { url: `http://${host}:${port}/`, stop: () => server.close() };
}

/** Returns a boolean per item: true when it matched in any state at any width. */
export async function measureUsage(url, getItems) {
  const browser = await launchBrowser();
  let used = null;
  let items = null;
  try {
    for (const viewport of WIDTHS) {
      const page = await browser.newPage({ permissions: ['microphone'], viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
      await page.goto(url);
      await page.locator('.connect-button').waitFor();
      items ??= await getItems(page);
      used ??= items.map(() => false);
      await visitStates(page, async () => {
        const matches = await page.evaluate(matchSelectorsInPage, items);
        matches.forEach((match, index) => { if (match) used[index] = true; });
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return { items, used };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const preview = await startPreview();
  try {
    const { items, used } = await measureUsage(preview.url, (page) => page.evaluate(collectRulesInPage));
    const unused = [...new Set(items.filter((_, index) => !used[index]).map((item) => (item.media ? `@media ${item.media} { ${item.selector} }` : item.selector)))];
    if (process.argv.includes('--json')) console.log(JSON.stringify(unused, null, 2));
    else {
      console.log(unused.join('\n'));
      console.log(`\n${unused.length} unused of ${items.length} selectors`);
    }
  } finally {
    await preview.stop();
  }
}
