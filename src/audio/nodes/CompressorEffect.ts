import { PedalParamValue } from '../types';
import { BaseEffect } from './BaseEffect';

type ReductionListener = (reductionDb: number) => void;

const reductionListeners = new Map<string, Set<ReductionListener>>();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const dbToGain = (db: number) => 10 ** (db / 20);

const percentToUnit = (value: number, fallback = 0) =>
  clamp(Number.isFinite(value) ? value : fallback, 0, 100) / 100;

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.015) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

export const subscribeCompressorReduction = (id: string, listener: ReductionListener) => {
  const listeners = reductionListeners.get(id) ?? new Set<ReductionListener>();
  listeners.add(listener);
  reductionListeners.set(id, listeners);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      reductionListeners.delete(id);
    }
  };
};

export class CompressorEffect extends BaseEffect {
  private readonly compressor: DynamicsCompressorNode;
  private readonly makeupGain: GainNode;
  private threshold = -28;
  private ratio = 3.5;
  private attack = 0.012;
  private release = 0.22;
  private knee = 18;
  private sustain = 42;
  private level = 72;
  private reductionRaf = 0;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'compressor');
    this.compressor = context.createDynamicsCompressor();
    this.makeupGain = context.createGain();

    this.connectWet(this.compressor, this.makeupGain);
    this.setMix(0.78);
    this.applyAll(false);
    this.startReductionMeter();

    this.paramHandlers.set('threshold', (value) => {
      this.threshold = clamp(asNumber(value, -28), -60, -10);
      this.applyCompression();
    });
    this.paramHandlers.set('thresholdDb', (value) => {
      this.threshold = clamp(asNumber(value, -28), -60, -10);
      this.applyCompression();
    });
    this.paramHandlers.set('ratio', (value) => {
      this.ratio = clamp(asNumber(value, 3.5), 1, 20);
      this.applyCompression();
    });
    this.paramHandlers.set('attack', (value) => {
      this.attack = clamp(asNumber(value, 0.012), 0.001, 0.1);
      smoothParam(context, this.compressor.attack, this.attack, 0.01);
    });
    this.paramHandlers.set('release', (value) => {
      this.release = clamp(asNumber(value, 0.22), 0.05, 1);
      smoothParam(context, this.compressor.release, this.release, 0.018);
    });
    this.paramHandlers.set('knee', (value) => {
      this.knee = clamp(asNumber(value, 18), 0, 40);
      smoothParam(context, this.compressor.knee, this.knee, 0.018);
    });
    this.paramHandlers.set('sustain', (value) => {
      this.sustain = clamp(asNumber(value, 42), 0, 100);
      this.applyCompression();
      this.applyLevel();
    });
    this.paramHandlers.set('mix', (value) => this.setMix(percentToUnit(asNumber(value, 78), 78)));
    this.paramHandlers.set('level', (value) => {
      this.level = clamp(asNumber(value, 72), 0, 100);
      this.applyLevel();
    });
    this.paramHandlers.set('makeupGainDb', (value) => {
      const db = clamp(asNumber(value, 0), -24, 18);
      smoothParam(context, this.makeupGain.gain, dbToGain(db), 0.018);
    });
  }

  override dispose() {
    window.cancelAnimationFrame(this.reductionRaf);
    reductionListeners.delete(this.id);
    super.dispose();
  }

  private applyAll(smooth = true) {
    this.applyCompression(smooth);
    this.applyLevel(smooth);
    this.setAudioParam(this.compressor.attack, this.attack, smooth ? 0.01 : 0);
    this.setAudioParam(this.compressor.release, this.release, smooth ? 0.018 : 0);
    this.setAudioParam(this.compressor.knee, this.knee, smooth ? 0.018 : 0);
  }

  private applyCompression(smooth = true) {
    const sustainAmount = percentToUnit(this.sustain, 42);
    const effectiveThreshold = clamp(this.threshold - sustainAmount * 24, -60, -10);
    const effectiveRatio = clamp(this.ratio + sustainAmount * 10.5, 1, 20);

    this.setAudioParam(this.compressor.threshold, effectiveThreshold, smooth ? 0.018 : 0);
    this.setAudioParam(this.compressor.ratio, effectiveRatio, smooth ? 0.018 : 0);
  }

  private applyLevel(smooth = true) {
    const sustainAmount = percentToUnit(this.sustain, 42);
    const levelAmount = percentToUnit(this.level, 72);
    const makeupDb = -10 + levelAmount * 20 + sustainAmount * 5.5;
    this.setAudioParam(this.makeupGain.gain, dbToGain(makeupDb), smooth ? 0.018 : 0);
  }

  private setAudioParam(param: AudioParam, value: number, seconds: number) {
    if (seconds <= 0) {
      param.setValueAtTime(value, this.context.currentTime);
      return;
    }

    smoothParam(this.context, param, value, seconds);
  }

  private startReductionMeter() {
    const tick = () => {
      const listeners = reductionListeners.get(this.id);
      if (listeners?.size) {
        listeners.forEach((listener) => listener(this.compressor.reduction));
      }

      this.reductionRaf = window.requestAnimationFrame(tick);
    };

    this.reductionRaf = window.requestAnimationFrame(tick);
  }
}
