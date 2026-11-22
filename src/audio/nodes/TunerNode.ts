import { PedalParamValue } from '../types';
import {
  NoteInfo,
  TunerMode,
  clamp,
  detectPitchYIN,
  frequencyToNoteInfo,
  isTunerMode,
} from '../utils/pitch';
import { BaseEffect } from './BaseEffect';
import { PEDAL_SCHEMAS } from '../params/schema';

const S = PEDAL_SCHEMAS.tuner;

export type TunerReading = {
  frequency: number | null;
  note: NoteInfo | null;
  cents: number;
  rms: number;
  clarity: number;
  signalLow: boolean;
};

type TunerListener = (reading: TunerReading) => void;

const listenersById = new Map<string, Set<TunerListener>>();

export const emptyTunerReading: TunerReading = {
  frequency: null,
  note: null,
  cents: 0,
  rms: 0,
  clarity: 0,
  signalLow: true,
};

export const subscribeTuner = (id: string, listener: TunerListener) => {
  const listeners = listenersById.get(id) ?? new Set<TunerListener>();
  listeners.add(listener);
  listenersById.set(id, listeners);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      listenersById.delete(id);
    }
  };
};

export class TunerNode extends BaseEffect {
  private readonly analyser: AnalyserNode;
  private readonly buffer: Float32Array<ArrayBuffer>;
  private referenceA4 = 440;
  private tunerMode: TunerMode = 'guitar';
  private sensitivity = 64;
  private smoothing = 62;
  private smoothedFrequency: number | null = null;
  private rafId = 0;
  private lastReadAt = 0;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'tuner');
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.buffer = new Float32Array(this.analyser.fftSize);
    this.connectWet(this.analyser);
    this.setMix(1);
    this.start();

    this.paramHandlers.set('referenceA4', (value) => {
      this.referenceA4 = clamp(asNumber(value, S.referenceA4.default), S.referenceA4.min, S.referenceA4.max);
    });
    this.paramHandlers.set('referenceHz', (value) => {
      this.referenceA4 = clamp(asNumber(value, S.referenceA4.default), S.referenceA4.min, S.referenceA4.max);
    });
    this.paramHandlers.set('mode', (value) => {
      this.tunerMode = isTunerMode(value) ? value : 'guitar';
    });
    this.paramHandlers.set('sensitivity', (value) => {
      this.sensitivity = clamp(asNumber(value, S.sensitivity.default), S.sensitivity.min, S.sensitivity.max);
    });
    this.paramHandlers.set('smoothing', (value) => {
      this.smoothing = clamp(asNumber(value, S.smoothing.default), S.smoothing.min, S.smoothing.max);
    });
  }

  override dispose() {
    window.cancelAnimationFrame(this.rafId);
    this.publish(emptyTunerReading);
    super.dispose();
  }

  private start() {
    const tick = (timestamp: number) => {
      if (listenersById.get(this.id)?.size && timestamp - this.lastReadAt >= 50) {
        this.lastReadAt = timestamp;
        this.readPitch();
      }

      this.rafId = window.requestAnimationFrame(tick);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  private readPitch() {
    this.analyser.getFloatTimeDomainData(this.buffer);
    const threshold = 0.18 - (this.sensitivity / 100) * 0.12;
    const detection = detectPitchYIN(this.buffer, this.context.sampleRate, 40, 1000, threshold);
    const signalThreshold = 0.0048 - (this.sensitivity / 100) * 0.0038;

    if (!detection || detection.rms < signalThreshold || detection.clarity < 0.58) {
      this.publish({
        ...emptyTunerReading,
        rms: detection?.rms ?? estimateRms(this.buffer),
        clarity: detection?.clarity ?? 0,
      });
      return;
    }

    const smoothingAmount = this.smoothing / 100;
    this.smoothedFrequency =
      this.smoothedFrequency === null
        ? detection.frequency
        : this.smoothedFrequency * smoothingAmount + detection.frequency * (1 - smoothingAmount);
    const note = frequencyToNoteInfo(this.smoothedFrequency, this.referenceA4, this.tunerMode);

    this.publish({
      frequency: this.smoothedFrequency,
      note,
      cents: note.cents,
      rms: detection.rms,
      clarity: detection.clarity,
      signalLow: false,
    });
  }

  private publish(reading: TunerReading) {
    const listeners = listenersById.get(this.id);
    if (!listeners?.size) {
      return;
    }

    listeners.forEach((listener) => listener(reading));
  }
}

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const estimateRms = (buffer: Float32Array<ArrayBufferLike>) => {
  let sum = 0;

  for (let index = 0; index < buffer.length; index += 1) {
    sum += buffer[index] * buffer[index];
  }

  return Math.sqrt(sum / buffer.length);
};
