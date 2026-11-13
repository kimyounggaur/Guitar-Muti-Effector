import { PedalParamValue } from '../types';
import { BaseEffect } from './BaseEffect';
import processorUrl from '../worklets/compressor-processor.ts?worker&url';

type ReductionListener = (reductionDb: number) => void;
const reductionListeners = new Map<string, Set<ReductionListener>>();
const loadedContexts = new WeakMap<AudioContext, Promise<void>>();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const asNumber = (value: PedalParamValue, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const percentToUnit = (value: number) => clamp(value, 0, 100) / 100;

export function prepareCompressor(context: AudioContext): Promise<void> {
  let promise = loadedContexts.get(context);
  if (!promise) {
    if (!context.audioWorklet) return Promise.reject(new Error('이 브라우저는 컴프레서를 지원하지 않습니다. HTTPS의 최신 브라우저를 사용해 주세요.'));
    promise = context.audioWorklet.addModule(processorUrl);
    loadedContexts.set(context, promise);
  }
  return promise;
}
export const subscribeCompressorReduction = (id: string, listener: ReductionListener) => {
  const listeners = reductionListeners.get(id) ?? new Set<ReductionListener>();
  listeners.add(listener);
  reductionListeners.set(id, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) reductionListeners.delete(id);
  };
};

export class CompressorEffect extends BaseEffect {
  private readonly compressor: AudioWorkletNode;
  private readonly makeupGain: GainNode;
  private threshold = -28;
  private ratio = 3.5;
  private sustain = 42;
  private level = 72;
  private isBypassed = false;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'compressor');
    this.compressor = new AudioWorkletNode(context, 'compressor-processor', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    });
    this.makeupGain = context.createGain();
    this.connectWet(this.compressor, this.makeupGain);
    this.setMix(0.78);
    this.applyCompression();
    this.applyLevel();
    this.compressor.port.onmessage = ({ data }: MessageEvent) => {
      if (data?.type === 'reduction' && typeof data.value === 'number') {
        reductionListeners.get(this.id)?.forEach((listener) => listener(this.isBypassed ? 0 : data.value));
      }
    };
    this.paramHandlers.set('threshold', (v) => { this.threshold = clamp(asNumber(v, -28), -60, -10); this.applyCompression(); });
    this.paramHandlers.set('thresholdDb', (v) => { this.threshold = clamp(asNumber(v, -28), -60, -10); this.applyCompression(); });
    this.paramHandlers.set('ratio', (v) => { this.ratio = clamp(asNumber(v, 3.5), 1, 20); this.applyCompression(); });
    this.paramHandlers.set('attack', (v) => this.send('attack', clamp(asNumber(v, 0.012), 0.001, 0.1)));
    this.paramHandlers.set('release', (v) => this.send('release', clamp(asNumber(v, 0.22), 0.05, 1)));
    this.paramHandlers.set('knee', (v) => this.send('knee', clamp(asNumber(v, 18), 0, 40)));
    this.paramHandlers.set('sustain', (v) => { this.sustain = clamp(asNumber(v, 42), 0, 100); this.applyCompression(); this.applyLevel(); });
    this.paramHandlers.set('mix', (v) => this.setMix(percentToUnit(asNumber(v, 78))));
    this.paramHandlers.set('level', (v) => { this.level = clamp(asNumber(v, 72), 0, 100); this.applyLevel(); });
    this.paramHandlers.set('makeupGainDb', (v) => this.setGainDb(clamp(asNumber(v, 0), -24, 4)));
  }
  override setBypass(bypassed: boolean) {
    this.isBypassed = bypassed;
    super.setBypass(bypassed);
    if (bypassed) reductionListeners.get(this.id)?.forEach((listener) => listener(0));
  }
  override dispose() {
    this.compressor.port.onmessage = null;
    this.compressor.port.close();
    reductionListeners.get(this.id)?.forEach((listener) => listener(0));
    super.dispose();
  }
  private send(name: string, value: number) { this.compressor.port.postMessage({ name, value }); }
  private applyCompression() {
    const sustain = percentToUnit(this.sustain);
    this.send('threshold', clamp(this.threshold - sustain * 24, -60, -10));
    this.send('ratio', clamp(this.ratio + sustain * 10.5, 1, 20));
  }
  private applyLevel() {
    this.setGainDb(clamp(-12 + percentToUnit(this.level) * 14 + percentToUnit(this.sustain) * 2, -24, 4));
  }
  private setGainDb(db: number) {
    const now = this.context.currentTime;
    this.makeupGain.gain.cancelScheduledValues(now);
    this.makeupGain.gain.setTargetAtTime(10 ** (db / 20), now, 0.018);
  }
}
