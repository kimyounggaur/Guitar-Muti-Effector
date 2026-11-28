import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Peak/RMS (after preset trim, before limiter and master) for all 108 factory presets.
// P0 recorded tests/e2e/baseline.json; from P3 on every change must stay within ±0.1 dB of it.
const PROBE_URL = 'http://localhost:5174/tests/e2e/harness/preset-probe.html';
const TOLERANCE_DB = 0.1;

type Row = { id: string; name: string; outputTrimDb: number; peakDb: number; rmsDb: number };

test('factory preset output levels match the P0 baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'audio probe runs once');
  test.setTimeout(600_000);
  await page.goto(PROBE_URL);
  await page.waitForFunction(() => 'measureFactoryPresets' in window, undefined, { timeout: 60_000 });
  const rows = await page.evaluate(() => (window as unknown as { measureFactoryPresets: () => Promise<Row[]> }).measureFactoryPresets());
  await testInfo.attach('presets.json', { body: JSON.stringify(rows, null, 2), contentType: 'application/json' });

  expect(rows).toHaveLength(108);
  const peaks = rows.map((row) => row.peakDb);
  const levels = rows.map((row) => row.rmsDb);
  const peakMinDb = Math.min(...peaks), peakMaxDb = Math.max(...peaks);
  const rmsMinDb = Math.min(...levels), rmsMaxDb = Math.max(...levels);
  const rmsSpreadDb = Number((rmsMaxDb - rmsMinDb).toFixed(2));
  await testInfo.attach('preset-summary.json', {
    body: JSON.stringify({ count: rows.length, peakMinDb, peakMaxDb, rmsMinDb, rmsMaxDb, rmsSpreadDb,
      targetPeakDb: -6, targetRmsSpreadDb: 6, rmsTargetMet: rmsSpreadDb <= 6 }),
    contentType: 'application/json',
  });
  expect(peakMaxDb, 'factory presets must peak at or below −6 dBFS before the master').toBeLessThanOrEqual(-6);
  if (rmsSpreadDb > 6) {
    testInfo.annotations.push({ type: 'acoustic target', description: `RMS spread ${rmsSpreadDb} dB exceeds the 6 dB design target.` });
  }

  const baseline = JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8')) as { presets: Row[] };
  expect(rows.length).toBe(baseline.presets.length);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const differences = baseline.presets.flatMap((expected) => {
    const actual = byId.get(expected.id);
    if (!actual) return [`${expected.id}: missing`];
    const peak = actual.peakDb - expected.peakDb;
    const rms = actual.rmsDb - expected.rmsDb;
    return Math.abs(peak) > TOLERANCE_DB || Math.abs(rms) > TOLERANCE_DB
      ? [`${expected.name}: peak ${peak.toFixed(2)} dB, rms ${rms.toFixed(2)} dB`]
      : [];
  });
  expect(differences, differences.join('\n')).toEqual([]);
});
