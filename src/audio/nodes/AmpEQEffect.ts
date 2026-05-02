import { PedalParamValue } from '../types';
import { BaseEffect } from './BaseEffect';

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

export class AmpEQEffect extends BaseEffect {
  private readonly lowCut: BiquadFilterNode;
  private readonly bass: BiquadFilterNode;
  private readonly mid: BiquadFilterNode;
  private readonly treble: BiquadFilterNode;
  private readonly presence: BiquadFilterNode;
  private readonly levelGain: GainNode;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'ampEQ');
    this.lowCut = context.createBiquadFilter();
    this.bass = context.createBiquadFilter();
    this.mid = context.createBiquadFilter();
    this.treble = context.createBiquadFilter();
    this.presence = context.createBiquadFilter();
    this.levelGain = context.createGain();

    this.lowCut.type = 'highpass';
    this.lowCut.frequency.value = 70;
    this.lowCut.Q.value = 0.707;

    this.bass.type = 'lowshelf';
    this.bass.frequency.value = 120;

    this.mid.type = 'peaking';
    this.mid.frequency.value = 760;
    this.mid.Q.value = 0.9;

    this.treble.type = 'highshelf';
    this.treble.frequency.value = 2600;

    this.presence.type = 'peaking';
    this.presence.frequency.value = 4200;
    this.presence.Q.value = 0.75;

    this.levelGain.gain.value = dbToGain(0);
    this.connectWet(this.lowCut, this.bass, this.mid, this.treble, this.presence, this.levelGain);
    this.setMix(1);

    this.paramHandlers.set('lowCut', (value) =>
      smoothParam(context, this.lowCut.frequency, clamp(asNumber(value, 70), 40, 160), 0.018),
    );
    this.paramHandlers.set('bass', (value) =>
      smoothParam(context, this.bass.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('bassDb', (value) =>
      smoothParam(context, this.bass.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('mid', (value) =>
      smoothParam(context, this.mid.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('midDb', (value) =>
      smoothParam(context, this.mid.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('midFreq', (value) =>
      smoothParam(context, this.mid.frequency, clamp(asNumber(value, 760), 250, 1500), 0.018),
    );
    this.paramHandlers.set('midQ', (value) =>
      smoothParam(context, this.mid.Q, clamp(asNumber(value, 0.9), 0.3, 4), 0.018),
    );
    this.paramHandlers.set('treble', (value) =>
      smoothParam(context, this.treble.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('trebleDb', (value) =>
      smoothParam(context, this.treble.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('presence', (value) =>
      smoothParam(context, this.presence.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('presenceDb', (value) =>
      smoothParam(context, this.presence.gain, clamp(asNumber(value, 0), -12, 12), 0.018),
    );
    this.paramHandlers.set('level', (value) => {
      const gainDb = -24 + percentToUnit(asNumber(value, 72), 72) * 30;
      smoothParam(context, this.levelGain.gain, dbToGain(gainDb), 0.018);
    });
  }
}
