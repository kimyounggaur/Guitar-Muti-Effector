import { PedalParamValue } from '../types';
import { DriveMode, clamp, createDriveCurve, isDriveMode, percentToUnit } from '../utils/curves';
import { BaseEffect } from './BaseEffect';

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.015) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

export class DriveEffect extends BaseEffect {
  private readonly preGain: GainNode;
  private readonly shaper: WaveShaperNode;
  private readonly midFocus: BiquadFilterNode;
  private readonly toneFilter: BiquadFilterNode;
  private readonly outputGain: GainNode;
  private mode: DriveMode = 'overdrive';
  private drive = 48;
  private tone = 58;
  private level = 72;
  private bias = 0;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'drive');
    this.preGain = context.createGain();
    this.shaper = context.createWaveShaper();
    this.midFocus = context.createBiquadFilter();
    this.toneFilter = context.createBiquadFilter();
    this.outputGain = context.createGain();

    this.shaper.oversample = '4x';
    this.midFocus.type = 'peaking';
    this.midFocus.frequency.value = 920;
    this.midFocus.Q.value = 0.95;
    this.toneFilter.type = 'lowpass';

    this.connectWet(this.preGain, this.shaper, this.midFocus, this.toneFilter, this.outputGain);
    this.setMix(1);
    this.applyAll(false);

    this.paramHandlers.set('mode', (value) => {
      this.mode = isDriveMode(value) ? value : 'overdrive';
      this.applyAll();
    });
    this.paramHandlers.set('drive', (value) => {
      this.drive = clamp(asNumber(value, 48), 0, 100);
      this.applyDrive();
    });
    this.paramHandlers.set('gain', (value) => {
      this.drive = clamp(asNumber(value, 5) * 5, 0, 100);
      this.applyDrive();
    });
    this.paramHandlers.set('tone', (value) => {
      this.tone = clamp(asNumber(value, 58), 0, 100);
      this.applyTone();
    });
    this.paramHandlers.set('level', (value) => {
      this.level = clamp(asNumber(value, 72), 0, 100);
      this.applyLevel();
    });
    this.paramHandlers.set('mix', (value) => this.setMix(percentToUnit(asNumber(value, 100), 100)));
    this.paramHandlers.set('bias', (value) => {
      this.bias = clamp(asNumber(value, 0), -1, 1);
      this.updateCurve();
    });
  }

  private applyAll(smooth = true) {
    this.applyDrive(smooth);
    this.applyTone(smooth);
    this.applyLevel(smooth);
    this.updateCurve();
  }

  private applyDrive(smooth = true) {
    const amount = percentToUnit(this.drive, 48);
    const modeGain = {
      overdrive: 1.35,
      crunch: 1.85,
      distortion: 2.65,
      fuzz: 3.45,
    }[this.mode];
    const target = 1 + amount * 16 * modeGain;
    this.setAudioParam(this.preGain.gain, target, smooth ? 0.018 : 0);
    this.updateCurve();
  }

  private applyTone(smooth = true) {
    const amount = percentToUnit(this.tone, 58);
    const frequency = 950 + amount ** 1.35 * 8900;
    const resonance = 0.58 + amount * 0.34;
    this.setAudioParam(this.toneFilter.frequency, frequency, smooth ? 0.018 : 0);
    this.setAudioParam(this.toneFilter.Q, resonance, smooth ? 0.018 : 0);

    const midGain = this.mode === 'crunch' ? 2.4 + percentToUnit(this.drive, 48) * 1.8 : 0;
    this.setAudioParam(this.midFocus.gain, midGain, smooth ? 0.018 : 0);
  }

  private applyLevel(smooth = true) {
    const amount = percentToUnit(this.level, 72);
    const compensation = {
      overdrive: 0.95,
      crunch: 0.84,
      distortion: 0.72,
      fuzz: 0.62,
    }[this.mode];
    const target = (0.02 + amount * 1.6) * compensation;
    this.setAudioParam(this.outputGain.gain, target, smooth ? 0.018 : 0);
  }

  private updateCurve() {
    this.shaper.curve = createDriveCurve(this.mode, this.drive, this.bias);
  }

  private setAudioParam(param: AudioParam, value: number, seconds: number) {
    if (seconds <= 0) {
      param.setValueAtTime(value, this.context.currentTime);
      return;
    }

    smoothParam(this.context, param, value, seconds);
  }
}
