import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dragKnobValue } from '../src/components/controls/knobValue';

test('dragging down never raises a knob, even from a preset value between steps', () => {
  for (const [min, max, step] of [[0, 100, 1], [-36, 0, 0.5], [0.01, 0.85, 0.01]]) {
    for (let i = 0; i <= 100; i++) {
      const start = Math.min(max, min + (max - min) * i / 100);
      let previous = max;
      for (const delta of [-1000, -160, -80, -1, -0.001, 0, 0.001, 1, 80, 160, 1000]) {
        const value = dragKnobValue(start, delta, min, max, step);
        assert.ok(value >= min && value <= max);
        assert.ok(value <= previous);
        if (delta === 0) assert.equal(value, start);
        previous = value;
      }
    }
  }
  assert.equal(dragKnobValue(30.7, 0.01, 0, 100, 1), 30.7);
});

test('a full relative drag stops at the end of the range without wrapping', () => {
  assert.equal(dragKnobValue(30, 160, 0, 100, 1), 0);
  assert.equal(dragKnobValue(30, -160, 0, 100, 1), 100);
  assert.equal(dragKnobValue(0.5, 16, 0, 1, 0.01), 0.4);
});
