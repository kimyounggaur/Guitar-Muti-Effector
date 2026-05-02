import { PedalParamValue } from '../types';
import {
  ReverbMode,
  createSyntheticReverbImpulse,
  defaultDecayForMode,
  readReverbMode,
  reverbModeToIRUrl,
} from '../utils/impulse';
import { BaseEffect } from './BaseEffect';

type ReverbLane = {
  preDelay: DelayNode;
  lowCut: BiquadFilterNode;
  convolver: ConvolverNode;
  highCut: BiquadFilterNode;
  levelGain: GainNode;
  laneGain: GainNode;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const percentToUnit = (value: number, fallback = 0) =>
  clamp(Number.isFinite(value) ? value : fallback, 0, 100) / 100;

const dbToGain = (db: number) => 10 ** (db / 20);

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.015) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

const safeDisconnect = (node: AudioNode) => {
  try {
    node.disconnect();
  } catch {
    // The node may already be disconnected during IR crossfades or shutdown.
  }
};

export class ReverbEffect extends BaseEffect {
  private mode: ReverbMode = 'room';
  private decay = defaultDecayForMode('room');
  private preDelayMs = 22;
  private lowCutFrequency = 120;
  private highCutFrequency = 7600;
  private level = 72;
  private activeLane: ReverbLane;
  private loadToken = 0;
  private crossfadeTimer = 0;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'reverb');
    this.activeLane = this.createLane(createSyntheticReverbImpulse(context, this.mode, this.decay), 1);
    this.setMix(0.24);
    this.applyLaneParams(this.activeLane, false);
    void this.loadImpulse();

    this.paramHandlers.set('mode', (value) => {
      this.mode = readReverbMode(value);
      this.decay = clamp(this.decay || defaultDecayForMode(this.mode), 0.2, 10);
      void this.loadImpulse();
    });
    this.paramHandlers.set('decay', (value) => {
      this.decay = clamp(asNumber(value, defaultDecayForMode(this.mode)), 0.2, 10);
      void this.loadImpulse();
    });
    this.paramHandlers.set('size', (value) => {
      this.decay = clamp(0.2 + clamp(asNumber(value, 0.45), 0, 1) * 5.8, 0.2, 10);
      void this.loadImpulse();
    });
    this.paramHandlers.set('preDelay', (value) => {
      this.preDelayMs = clamp(asNumber(value, 22), 0, 200);
      smoothParam(context, this.activeLane.preDelay.delayTime, this.preDelayMs / 1000, 0.018);
    });
    this.paramHandlers.set('lowCut', (value) => {
      this.lowCutFrequency = clamp(asNumber(value, 120), 20, 500);
      smoothParam(context, this.activeLane.lowCut.frequency, this.lowCutFrequency, 0.018);
    });
    this.paramHandlers.set('highCut', (value) => {
      this.highCutFrequency = clamp(asNumber(value, 7600), 1000, 12000);
      smoothParam(context, this.activeLane.highCut.frequency, this.highCutFrequency, 0.018);
    });
    this.paramHandlers.set('damping', (value) => {
      this.highCutFrequency = clamp(12000 - clamp(asNumber(value, 0.4), 0, 1) * 9000, 1000, 12000);
      smoothParam(context, this.activeLane.highCut.frequency, this.highCutFrequency, 0.018);
    });
    this.paramHandlers.set('mix', (value) => {
      const numberValue = asNumber(value, 24);
      this.setMix(numberValue <= 1 ? numberValue : percentToUnit(numberValue, 24));
    });
    this.paramHandlers.set('level', (value) => {
      this.level = clamp(asNumber(value, 72), 0, 100);
      smoothParam(context, this.activeLane.levelGain.gain, this.levelToGain(), 0.018);
    });
  }

  override dispose() {
    window.clearTimeout(this.crossfadeTimer);
    this.disposeLane(this.activeLane);
    super.dispose();
  }

  private async loadImpulse() {
    const token = ++this.loadToken;
    const buffer = await this.resolveImpulse();

    if (token !== this.loadToken) {
      return;
    }

    this.crossfadeTo(buffer);
  }

  private async resolveImpulse() {
    const url = reverbModeToIRUrl(this.mode);

    if (url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`IR not found: ${url}`);
        }

        const data = await response.arrayBuffer();
        return await this.context.decodeAudioData(data);
      } catch {
        return createSyntheticReverbImpulse(this.context, this.mode, this.decay);
      }
    }

    return createSyntheticReverbImpulse(this.context, this.mode, this.decay);
  }

  private crossfadeTo(buffer: AudioBuffer) {
    const nextLane = this.createLane(buffer, 0);
    this.applyLaneParams(nextLane, false);
    const previousLane = this.activeLane;
    this.activeLane = nextLane;

    const now = this.context.currentTime;
    previousLane.laneGain.gain.cancelScheduledValues(now);
    nextLane.laneGain.gain.cancelScheduledValues(now);
    previousLane.laneGain.gain.setValueAtTime(previousLane.laneGain.gain.value, now);
    nextLane.laneGain.gain.setValueAtTime(0, now);
    previousLane.laneGain.gain.linearRampToValueAtTime(0, now + 0.06);
    nextLane.laneGain.gain.linearRampToValueAtTime(1, now + 0.06);

    window.clearTimeout(this.crossfadeTimer);
    this.crossfadeTimer = window.setTimeout(() => this.disposeLane(previousLane), 90);
  }

  private createLane(buffer: AudioBuffer, gain: number): ReverbLane {
    const preDelay = this.context.createDelay(0.22);
    const lowCut = this.context.createBiquadFilter();
    const convolver = this.context.createConvolver();
    const highCut = this.context.createBiquadFilter();
    const levelGain = this.context.createGain();
    const laneGain = this.context.createGain();

    lowCut.type = 'highpass';
    highCut.type = 'lowpass';
    convolver.normalize = true;
    convolver.buffer = buffer;
    laneGain.gain.value = gain;

    this.wetInput.connect(preDelay);
    preDelay.connect(lowCut);
    lowCut.connect(convolver);
    convolver.connect(highCut);
    highCut.connect(levelGain);
    levelGain.connect(laneGain);
    laneGain.connect(this.wetOutput);

    return { preDelay, lowCut, convolver, highCut, levelGain, laneGain };
  }

  private applyLaneParams(lane: ReverbLane, smooth = true) {
    const seconds = smooth ? 0.018 : 0;
    this.setAudioParam(lane.preDelay.delayTime, this.preDelayMs / 1000, seconds);
    this.setAudioParam(lane.lowCut.frequency, this.lowCutFrequency, seconds);
    this.setAudioParam(lane.lowCut.Q, 0.707, seconds);
    this.setAudioParam(lane.highCut.frequency, this.highCutFrequency, seconds);
    this.setAudioParam(lane.highCut.Q, this.mode === 'plate' ? 0.65 : 0.82, seconds);
    this.setAudioParam(lane.levelGain.gain, this.levelToGain(), seconds);
  }

  private levelToGain() {
    return dbToGain(-24 + percentToUnit(this.level, 72) * 30);
  }

  private setAudioParam(param: AudioParam, value: number, seconds: number) {
    if (seconds <= 0) {
      param.setValueAtTime(value, this.context.currentTime);
      return;
    }

    smoothParam(this.context, param, value, seconds);
  }

  private disposeLane(lane: ReverbLane) {
    safeDisconnect(lane.preDelay);
    safeDisconnect(lane.lowCut);
    safeDisconnect(lane.convolver);
    safeDisconnect(lane.highCut);
    safeDisconnect(lane.levelGain);
    safeDisconnect(lane.laneGain);
  }
}
