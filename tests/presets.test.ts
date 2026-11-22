// P5c: the factory library, migration and file I/O moved out of presetStore without changing a preset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildFactoryPresets } from '../src/presets/factory';
import { exportUserPresets, importPresets } from '../src/presets/io';
import { clonePreset } from '../src/presets/build';
import type { PedalboardPreset } from '../src/presets/types';

// sha256 of JSON.stringify(factory presets) on main before the split (2e1683e..P5b, 108 presets).
const FACTORY_SHA256 = 'f078781a8db8fc6abe3a5f8f29d8aa2ab3386aae65b0d41a34479e76f100ffb4';

test('factory presets are identical to the library before the split', () => {
  const presets = buildFactoryPresets();
  assert.equal(presets.length, 108);
  const hash = createHash('sha256').update(JSON.stringify(presets.map(clonePreset))).digest('hex');
  assert.equal(hash, FACTORY_SHA256);
  assert.equal(buildFactoryPresets(), presets, 'built once and cached');
});

const userPresets = (): PedalboardPreset[] =>
  buildFactoryPresets().slice(0, 3).map((preset, index) => ({ ...clonePreset(preset), id: `user-${index}`, name: `내 프리셋 ${index}`, origin: 'user', category: 'User Presets' }));

test('export → import round trip skips every preset that already exists', () => {
  const existing = [...buildFactoryPresets(), ...userPresets()];
  const json = exportUserPresets(existing);
  const result = importPresets(json, existing);
  assert.equal(result.imported, 0);
  assert.equal(result.skipped, 3);
  assert.deepEqual(result.presets, []);
});

test('factory presets never appear in an export', () => {
  const exported = JSON.parse(exportUserPresets([...buildFactoryPresets(), ...userPresets()]));
  assert.equal(exported.presets.length, 3);
  assert.ok(exported.presets.every((preset: PedalboardPreset) => preset.origin !== 'factory' && !preset.id.startsWith('factory-')));
});

test('importing into an empty library adds the presets as imported', () => {
  const result = importPresets(exportUserPresets(userPresets()), buildFactoryPresets());
  assert.equal(result.imported, 3);
  assert.equal(result.skipped, 0);
  assert.ok(result.presets.every((preset) => preset.origin === 'imported'));
});
