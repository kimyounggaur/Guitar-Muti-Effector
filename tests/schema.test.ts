// P3: the parameter schema is the single source for defaults, engine clamps and on-screen ranges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PEDAL_SCHEMAS, TEMPO, clampParam, clampTempo, defaultParams } from '../src/audio/params/schema';
import { createDefaultPedals, type PedalType } from '../src/audio/types';

const PEDAL_TYPES: PedalType[] = ['tuner', 'noiseGate', 'compressor', 'drive', 'ampEQ', 'cabinetIR', 'modulation', 'delay', 'reverb', 'looper', 'rhythm'];

test('every pedal type has a schema', () => {
  assert.deepEqual(Object.keys(PEDAL_SCHEMAS).sort(), [...PEDAL_TYPES].sort());
});

test('number specs are consistent: min ≤ default ≤ max, step > 0, safetyMax respected', () => {
  for (const [type, params] of Object.entries(PEDAL_SCHEMAS)) {
    for (const [name, spec] of Object.entries(params)) {
      if (spec.kind !== 'number') continue;
      const id = `${type}.${name}`;
      assert.ok(spec.min <= spec.default && spec.default <= spec.max, `${id} default out of range`);
      assert.ok(spec.step > 0, `${id} step`);
      if ('uiStep' in spec && spec.uiStep !== undefined) assert.ok(spec.uiStep >= spec.step, `${id} uiStep`);
      if ('safetyMax' in spec && spec.safetyMax !== undefined) assert.ok(spec.max <= spec.safetyMax, `${id} max above safetyMax`);
    }
    for (const [name, spec] of Object.entries(params)) {
      if (spec.kind === 'enum') assert.ok((spec.options as readonly string[]).includes(spec.default), `${type}.${name} enum default`);
    }
  }
});

test('no pedal schema carries its own tempo', () => {
  for (const [type, params] of Object.entries(PEDAL_SCHEMAS)) assert.ok(!('bpm' in params), `${type} has bpm`);
  assert.equal(clampTempo(10), TEMPO.min);
  assert.equal(clampTempo(999), TEMPO.max);
  assert.equal(clampTempo(Number.NaN), TEMPO.default);
});

test('safety ceilings: delay feedback never exceeds 0.85', () => {
  assert.equal(clampParam('delay', 'feedback', 0.99), 0.85);
  assert.equal(clampParam('delay', 'feedback', Infinity), PEDAL_SCHEMAS.delay.feedback.default);
  assert.equal(clampParam('modulation', 'feedback', 5), 0.95);
});

test('clampParam handles wrong types and snaps to the step grid', () => {
  assert.equal(clampParam('drive', 'drive', 'loud'), PEDAL_SCHEMAS.drive.drive.default);
  assert.equal(clampParam('drive', 'mode', 'unknown'), 'overdrive');
  assert.equal(clampParam('delay', 'sync', 'yes'), false);
  assert.equal(clampParam('ampEQ', 'bass', 1.23456), 1.23);
  assert.equal(clampParam('compressor', 'attack', 0.0123), 0.012);
});

test('default pedals come from the schema', () => {
  for (const pedal of createDefaultPedals()) {
    assert.deepEqual(pedal.params, defaultParams(pedal.type), pedal.id);
  }
});

test('108 factory presets are already inside the schema ranges', async () => {
  const { usePresetStore } = await import('../src/store/presetStore');
  const factory = usePresetStore.getState().presets.filter((preset) => preset.origin === 'factory');
  assert.equal(factory.length, 108);
  for (const preset of factory) {
    for (const pedal of preset.pedals) {
      for (const [name, value] of Object.entries(pedal.params)) {
        const clamped = clampParam(pedal.type, name, value);
        if (typeof value === 'number') assert.ok(Math.abs((clamped as number) - value) < 1e-9, `${preset.name} ${pedal.type}.${name}: ${value} → ${clamped}`);
        else assert.equal(clamped, value, `${preset.name} ${pedal.type}.${name}`);
      }
    }
  }
});
