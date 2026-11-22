// P1 / Q6: pitch wobble of delay-time modulation, computed from the values the effects actually set.
// For a delay modulated as D·sin(2πft), the instantaneous frequency ratio peaks at 1 + 2πfD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModulationEffect } from '../src/audio/nodes/ModulationEffect';
import { DelayEffect } from '../src/audio/nodes/DelayEffect';

class Param {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param(); delayTime = new Param(); pan = new Param();
  type = ''; curve: Float32Array | null = null;
  connect(node: unknown) { return node; }
  disconnect() {}
  start() {}
  stop() {}
}
const context = new Proxy({ currentTime: 0, sampleRate: 48000 } as Record<string, unknown>, {
  get(target, key) {
    if (key in target) return target[key as string];
    if (typeof key === 'string' && key.startsWith('create')) return () => new Node();
    return undefined;
  },
}) as unknown as AudioContext;

const cents = (rate: number, depthSeconds: number) => 1200 * Math.log2(1 + 2 * Math.PI * rate * depthSeconds);

test('Q6: default chorus pitch wobble ≤ ±15 cents', () => {
  const effect = new ModulationEffect(context, 'mod') as unknown as { setParam(n: string, v: unknown): void; chorusDepth: Node; lfo: Node };
  effect.setParam('mode', 'chorus');
  const depth = effect.chorusDepth.gain.value;
  const rate = effect.lfo.frequency.value;
  const value = cents(rate, depth);
  console.log(`chorus default: depth ${(depth * 1000).toFixed(3)} ms, rate ${rate} Hz → ±${value.toFixed(2)} cents`);
  assert.ok(value <= 15, `${value.toFixed(2)} cents`);
});

test('Q6: maximum tape flutter pitch wobble ≤ ±20 cents', () => {
  const effect = new DelayEffect(context, 'delay') as unknown as { setParam(n: string, v: unknown): void; lfoDepth: Node; lfo: Node };
  effect.setParam('mode', 'tape');
  effect.setParam('flutter', 100);
  const depth = effect.lfoDepth.gain.value;
  const rate = effect.lfo.frequency.value;
  const value = cents(rate, depth);
  console.log(`tape flutter max: depth ${(depth * 1000).toFixed(3)} ms, rate ${rate} Hz → ±${value.toFixed(2)} cents`);
  assert.ok(value <= 20, `${value.toFixed(2)} cents`);
});
