import { PedalParamValue } from '../types';
import { BaseEffect } from './BaseEffect';

type DelayMode = 'digital' | 'analog' | 'tape' | 'slapback' | 'pingpong';
type DelayDivision = '1/4' | '1/8' | 'dotted1/8' | '1/16';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const percentToUnit = (value: number, fallback = 0) =>
  clamp(Number.isFinite(value) ? value : fallback, 0, 100) / 100;

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.015) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

export class DelayEffect extends BaseEffect {
  private readonly monoDelay: DelayNode;
  private readonly monoTone: BiquadFilterNode;
  private readonly monoFeedback: GainNode;
  private readonly monoModeGain: GainNode;
  private readonly leftDelay: DelayNode;
  private readonly rightDelay: DelayNode;
  private readonly leftTone: BiquadFilterNode;
  private readonly rightTone: BiquadFilterNode;
  private readonly leftFeedback: GainNode;
  private readonly rightFeedback: GainNode;
  private readonly leftOutput: GainNode;
  private readonly rightOutput: GainNode;
  private readonly pingPongModeGain: GainNode;
  private readonly merger: ChannelMergerNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private mode: DelayMode = 'digital';
  private timeMs = 420;
  private feedback = 0.32;
  private tone = 62;
  private sync = false;
  private bpm = 120;
  private division: DelayDivision = '1/4';
  private flutter = 0;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'delay');
    this.monoDelay = context.createDelay(2);
    this.monoTone = context.createBiquadFilter();
    this.monoFeedback = context.createGain();
    this.monoModeGain = context.createGain();
    this.leftDelay = context.createDelay(2);
    this.rightDelay = context.createDelay(2);
    this.leftTone = context.createBiquadFilter();
    this.rightTone = context.createBiquadFilter();
    this.leftFeedback = context.createGain();
    this.rightFeedback = context.createGain();
    this.leftOutput = context.createGain();
    this.rightOutput = context.createGain();
    this.pingPongModeGain = context.createGain();
    this.merger = context.createChannelMerger(2);
    this.lfo = context.createOscillator();
    this.lfoDepth = context.createGain();

    this.configureFilters();
    this.connectDelayLines();
    this.setMix(0.28);
    this.applyAll(false);
    this.lfo.frequency.value = 4.8;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.monoDelay.delayTime);
    this.lfoDepth.connect(this.leftDelay.delayTime);
    this.lfoDepth.connect(this.rightDelay.delayTime);
    this.lfo.start();

    this.nodes.push(
      this.monoDelay,
      this.monoTone,
      this.monoFeedback,
      this.monoModeGain,
      this.leftDelay,
      this.rightDelay,
      this.leftTone,
      this.rightTone,
      this.leftFeedback,
      this.rightFeedback,
      this.leftOutput,
      this.rightOutput,
      this.pingPongModeGain,
      this.merger,
      this.lfo,
      this.lfoDepth,
    );

    this.paramHandlers.set('mode', (value) => {
      this.mode = readDelayMode(value);
      this.applyMode();
      this.applyTime();
      this.applyTone();
      this.applyFlutter();
    });
    this.paramHandlers.set('timeMs', (value) => {
      this.timeMs = clamp(asNumber(value, 420), 20, 2000);
      this.applyTime();
    });
    this.paramHandlers.set('feedback', (value) => {
      this.feedback = clamp(asNumber(value, 0.32), 0, 0.95);
      this.applyFeedback();
    });
    this.paramHandlers.set('mix', (value) => {
      const numberValue = asNumber(value, 28);
      this.setMix(numberValue <= 1 ? numberValue : percentToUnit(numberValue, 28));
    });
    this.paramHandlers.set('tone', (value) => {
      this.tone = clamp(asNumber(value, 62), 0, 100);
      this.applyTone();
    });
    this.paramHandlers.set('sync', (value) => {
      this.sync = value === true;
      this.applyTime();
    });
    this.paramHandlers.set('bpm', (value) => {
      this.bpm = clamp(asNumber(value, 120), 40, 240);
      this.applyTime();
    });
    this.paramHandlers.set('division', (value) => {
      this.division = readDivision(value);
      this.applyTime();
    });
    this.paramHandlers.set('flutter', (value) => {
      this.flutter = clamp(asNumber(value, 0), 0, 100);
      this.applyFlutter();
    });
  }

  override dispose() {
    try {
      this.lfo.stop();
    } catch {
      // The oscillator may already be stopped during audio shutdown.
    }

    super.dispose();
  }

  private configureFilters() {
    [this.monoTone, this.leftTone, this.rightTone].forEach((filter) => {
      filter.type = 'lowpass';
      filter.frequency.value = 6800;
      filter.Q.value = 0.72;
    });
  }

  private connectDelayLines() {
    this.wetInput.connect(this.monoDelay);
    this.monoDelay.connect(this.monoTone);
    this.monoTone.connect(this.monoFeedback);
    this.monoFeedback.connect(this.monoDelay);
    this.monoTone.connect(this.monoModeGain);
    this.monoModeGain.connect(this.wetOutput);

    this.wetInput.connect(this.leftDelay);
    this.leftDelay.connect(this.leftTone);
    this.leftTone.connect(this.leftOutput);
    this.leftOutput.connect(this.merger, 0, 0);
    this.leftTone.connect(this.rightFeedback);
    this.rightFeedback.connect(this.rightDelay);
    this.rightDelay.connect(this.rightTone);
    this.rightTone.connect(this.rightOutput);
    this.rightOutput.connect(this.merger, 0, 1);
    this.rightTone.connect(this.leftFeedback);
    this.leftFeedback.connect(this.leftDelay);
    this.merger.connect(this.pingPongModeGain);
    this.pingPongModeGain.connect(this.wetOutput);
  }

  private applyAll(smooth = true) {
    this.applyMode(smooth);
    this.applyTime(smooth);
    this.applyFeedback(smooth);
    this.applyTone(smooth);
    this.applyFlutter(smooth);
  }

  private applyMode(smooth = true) {
    const isPingPong = this.mode === 'pingpong';
    this.setAudioParam(this.monoModeGain.gain, isPingPong ? 0 : 1, smooth ? 0.018 : 0);
    this.setAudioParam(this.pingPongModeGain.gain, isPingPong ? 1 : 0, smooth ? 0.018 : 0);
  }

  private applyTime(smooth = true) {
    const seconds = this.getEffectiveTimeMs() / 1000;
    this.setAudioParam(this.monoDelay.delayTime, seconds, smooth ? 0.025 : 0);
    this.setAudioParam(this.leftDelay.delayTime, seconds, smooth ? 0.025 : 0);
    this.setAudioParam(this.rightDelay.delayTime, seconds, smooth ? 0.025 : 0);
  }

  private applyFeedback(smooth = true) {
    const modeScale = this.mode === 'slapback' ? 0.38 : this.mode === 'analog' ? 0.92 : 1;
    const feedback = clamp(this.feedback * modeScale, 0, 0.95);
    this.setAudioParam(this.monoFeedback.gain, feedback, smooth ? 0.018 : 0);
    this.setAudioParam(this.leftFeedback.gain, feedback, smooth ? 0.018 : 0);
    this.setAudioParam(this.rightFeedback.gain, feedback, smooth ? 0.018 : 0);
  }

  private applyTone(smooth = true) {
    const amount = percentToUnit(this.tone, 62);
    const modeCeiling = this.mode === 'analog' ? 5200 : this.mode === 'tape' ? 6200 : this.mode === 'slapback' ? 7600 : 9800;
    const modeFloor = this.mode === 'analog' ? 850 : 1200;
    const frequency = modeFloor + amount ** 1.35 * (modeCeiling - modeFloor);
    [this.monoTone, this.leftTone, this.rightTone].forEach((filter) => {
      this.setAudioParam(filter.frequency, frequency, smooth ? 0.018 : 0);
      this.setAudioParam(filter.Q, this.mode === 'tape' ? 0.9 : 0.72, smooth ? 0.018 : 0);
    });
  }

  private applyFlutter(smooth = true) {
    const flutterAmount = this.mode === 'tape' ? percentToUnit(this.flutter, 0) : 0;
    const depth = flutterAmount * 0.0065;
    const rate = 3.5 + flutterAmount * 4.5;
    this.setAudioParam(this.lfoDepth.gain, depth, smooth ? 0.025 : 0);
    this.setAudioParam(this.lfo.frequency, rate, smooth ? 0.025 : 0);
  }

  private getEffectiveTimeMs() {
    if (this.sync) {
      return clamp(bpmToDelayTimeMs(this.bpm, this.division), 20, 2000);
    }

    if (this.mode === 'slapback') {
      return clamp(this.timeMs, 80, 140);
    }

    return clamp(this.timeMs, 20, 2000);
  }

  private setAudioParam(param: AudioParam, value: number, seconds: number) {
    if (seconds <= 0) {
      param.setValueAtTime(value, this.context.currentTime);
      return;
    }

    smoothParam(this.context, param, value, seconds);
  }
}

export const bpmToDelayTimeMs = (bpm: number, division: DelayDivision) => {
  const quarterNote = 60000 / clamp(bpm, 40, 240);

  if (division === '1/8') {
    return quarterNote / 2;
  }

  if (division === 'dotted1/8') {
    return quarterNote * 0.75;
  }

  if (division === '1/16') {
    return quarterNote / 4;
  }

  return quarterNote;
};

const readDelayMode = (value: PedalParamValue): DelayMode => {
  if (value === 'digital' || value === 'analog' || value === 'tape' || value === 'slapback' || value === 'pingpong') {
    return value;
  }

  return 'digital';
};

const readDivision = (value: PedalParamValue): DelayDivision => {
  if (value === '1/4' || value === '1/8' || value === 'dotted1/8' || value === '1/16') {
    return value;
  }

  return '1/4';
};
