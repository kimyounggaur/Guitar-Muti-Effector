import { expect, test, type Page } from '@playwright/test';

// P1 / F9: presence and behaviour of the 14 controls listed in the analysis (see docs/controls-audit.md).
// Each check records what is on screen today so the audit table cannot silently drift.
const select = async (page: Page, name: string) => {
  await page.getByRole('button', { name: `${name} 설정 선택` }).first().click();
};

test.describe('controls audit', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'runs once');
    await page.goto('/');
    await page.locator('.connect-button').waitFor();
  });

  test('left panel buttons navigate', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: '빠른 이동' });
    await expect(nav.getByRole('button')).toHaveText(['페달 보드', '루퍼 열기', '프리셋 열기']);
    await nav.getByRole('button', { name: '루퍼 열기' }).click();
    await expect(page.locator('.detail-section')).toHaveAttribute('aria-label', '루퍼 조작');
    await nav.getByRole('button', { name: '프리셋 열기' }).click();
    await expect(page.locator('.preset-browser-frame')).toHaveAttribute('open', '');
  });

  test('tuner: power/bypass work, MUTE/CALIB/DISPLAY are gone, Amp EQ shortcut removed', async ({ page }) => {
    await page.locator('.tuner-hold-button').click(); // former HOLD TO TUNER
    const section = page.locator('.tuner-detail-section');
    await expect(section).toBeVisible();
    for (const label of ['MUTE', 'CALIB', 'DISPLAY']) await expect(section.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    const power = section.locator('.rack-tuner-right button').first();
    const before = await power.textContent();
    await power.click();
    await expect(power).not.toHaveText(before ?? '');
    // P2: the dead 'Amp EQ' shortcut (wrong pedal id) was removed.
    await expect(section.getByRole('button', { name: 'Amp EQ', exact: true })).toHaveCount(0);
  });

  test('drive: no SPRING REVERB/Blend, model arrows change the model', async ({ page }) => {
    await select(page, 'DRIVE');
    const section = page.locator('.detail-section');
    await expect(section.getByText(/SPRING REVERB|Blend/)).toHaveCount(0);
    const slot = section.locator('.drive-rack-model-slot > div');
    const model = await slot.textContent();
    await section.getByRole('button', { name: 'PRE MODEL 다음' }).click();
    await expect(slot).not.toHaveText(model ?? '');
  });

  test('compressor: GR meter present, no +10/+4 switch', async ({ page }) => {
    await select(page, 'COMP');
    const section = page.locator('.detail-section');
    await expect(section.locator('.comp-rack-vu-meter')).toHaveAttribute('aria-label', /게인 감소/);
    await expect(section.getByRole('button', { name: /^\+10|^\+4/ })).toHaveCount(0);
  });

  test('noise gate: Attack/Hold/릴리스 dials, no duplicate Depth, power button named 게이트 켜기', async ({ page }) => {
    await select(page, 'Noise Gate');
    const section = page.locator('.detail-section');
    for (const label of ['Attack', 'Hold', '릴리스', 'Sensitivity', '게이트 켜기']) await expect(section.getByText(label, { exact: true }).first()).toBeVisible();
    for (const label of ['Decay', 'Depth', 'Auto mode']) await expect(section.getByText(label, { exact: true })).toHaveCount(0);
  });

  test('meters, status bar and cabinet custom option', async ({ page }) => {
    await expect(page.locator('.patch-meters .screen-meter-pill')).toHaveCount(2); // IN / OUT RMS pills
    const status = page.locator('.master-status-bar');
    await expect(status.getByText('CPU')).toHaveCount(0);
    await expect(status.getByText('출력 지연')).toBeVisible();
    await select(page, 'CAB IR');
    const option = page.locator('.detail-section option[value="custom"]');
    await expect(option).toHaveCount(1);
    await expect(option).toHaveJSProperty('disabled', true); // enabled only after a WAV IR upload
  });
});
