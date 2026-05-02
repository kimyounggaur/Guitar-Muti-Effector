import { PedalParamValue } from '../types';
import { BaseEffect } from './BaseEffect';

export type ModulationMode = 'chorus' | 'flanger' | 'phaser' | 'tremolo' | 'vibrato';
export type ModulationDivision = '1/1' | '1/2' | '1/4' | '1/8' | 'dotted1/8' | '1/16';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const percentToUnit = (value: number, fallback = 0) =>
  clamp(Number.isFinite(value) ? value : fallback, 0, 100) / 100;

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.018) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

export class ModulationEffect extends BaseEffect {
  private readonly lfo: OscillatorNode;
  private readonly chorusDelay: DelayNode;
  private readonly chorusDepth: GainNode;
  private readonly chorusGain: GainNode;
  private readonly flangerDelay: DelayNode;
  private readonly flangerDepth: GainNode;
  private readonly flangerFeedback: GainNode;
  private readonly flangerGain: GainNode;
  private readonly phaserFilters: BiquadFilterNode[];
  private readonly phaserDepths: GainNode[];
  private readonly phaserFeedback: GainNode;
  private readonly phaserFeedbackDelay: DelayNode;
  private readonly phaserGain: GainNode;
  private readonly tremoloGain: GainNode;
  private readonly tremoloDepth: GainNode;
  private readonly tremoloModeGain: GainNode;
  private readonly vibratoDelay: DelayNode;
  private readonly vibratoDepth: GainNode;
  private readonly vibratoGain: GainNode;
  private readonly modeMixer: GainNode;
  private readonly toneFilter: BiquadFilterNode;
  private readonly centerGain: GainNode;
  private readonly widthGain: GainNode;
  private readonly leftWidthDelay: DelayNode;
  private readonly rightWidthDelay: DelayNode;
  private readonly widthMerger: ChannelMergerNode;
  private mode: ModulationMode = 'chorus';
  private rate = 0.85;
  private depth = 44;
  private feedback = 0.18;
  private tone = 68;
  private stereoWidth = 52;
  private sync = false;
  private bpm = 120;
  private division: ModulationDivision = '1/4';

  constructor(context: AudioContext, id: string) {
    super(context, id, 'modulation');
    this.lfo = context.createOscillator();
    this.chorusDelay = context.createDelay(0.05);
    this.chorusDepth = context.createGain();
    this.chorusGain = context.createGain();
    this.flangerDelay = context.createDelay(0.02);
    this.flangerDepth = context.createGain();
    this.flangerFeedback = context.createGain();
    this.flangerGain = context.createGain();
    this.phaserFilters = Array.from({ length: 4 }, () => context.createBiquadFilter());
    this.phaserDepths = this.phaserFilters.map(() => context.createGain());
    this.phaserFeedback = context.createGain();
    this.phaserFeedbackDelay = context.createDelay(0.004);
    this.phaserGain = context.createGain();
    this.tremoloGain = context.createGain();
    this.tremoloDepth = context.createGain();
    this.tremoloModeGain = context.createGain();
    this.vibratoDelay = context.createDelay(0.035);
    this.vibratoDepth = context.createGain();
    this.vibratoGain = context.createGain();
    this.modeMixer = context.createGain();
    this.toneFilter = context.createBiquadFilter();
    this.centerGain = context.createGain();
    this.widthGain = context.createGain();
    this.leftWidthDelay = context.createDelay(0.02);
    this.rightWidthDelay = context.createDelay(0.02);
    this.widthMerger = context.createChannelMerger(2);

    this.configureGraph();
    this.registerParams();
    this.applyAll(false);
    this.lfo.type = 'sine';
    this.lfo.start();
    this.setMix(0.42);
  }

  override dispose() {
    try {
      this.lfo.stop();
    } catch {
      // The oscillator may already be stopped during shutdown.
    }

    super.dispose();
  }

  private configureGraph() {
    this.wetInput.connect(this.chorusDelay);
    this.chorusDelay.connect(this.chorusGain);
    this.chorusGain.connect(this.modeMixer);

    this.wetInput.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerGain);
    this.flangerDelay.connect(this.flangerFeedback);
    this.flangerFeedback.connect(this.flangerDelay);
    this.flangerGain.connect(this.modeMixer);

    this.wetInput.connect(this.phaserFilters[0]);
    this.phaserFilters.forEach((filter, index) => {
      filter.type = 'allpass';
      filter.frequency.value = 420 + index * 260;
      filter.Q.value = 0.85;
      const next = this.phaserFilters[index + 1];
      if (next) {
        filter.connect(next);
      }
    });
    this.phaserFilters[this.phaserFilters.length - 1].connect(this.phaserGain);
    this.phaserFilters[this.phaserFilters.length - 1].connect(this.phaserFeedback);
    this.phaserFeedback.connect(this.phaserFeedbackDelay);
    this.phaserFeedbackDelay.connect(this.phaserFilters[0]);
    this.phaserGain.connect(this.modeMixer);

    this.wetInput.connect(this.tremoloGain);
    this.tremoloGain.connect(this.tremoloModeGain);
    this.tremoloModeGain.connect(this.modeMixer);

    this.wetInput.connect(this.vibratoDelay);
    this.vibratoDelay.connect(this.vibratoGain);
    this.vibratoGain.connect(this.modeMixer);

    this.modeMixer.connect(this.toneFilter);
    this.toneFilter.connect(this.centerGain);
    this.centerGain.connect(this.wetOutput);
    this.toneFilter.connect(this.leftWidthDelay);
    this.toneFilter.connect(this.rightWidthDelay);
    this.leftWidthDelay.connect(this.widthMerger, 0, 0);
    this.rightWidthDelay.connect(this.widthMerger, 0, 1);
    this.widthMerger.connect(this.widthGain);
    this.widthGain.connect(this.wetOutput);

    this.lfo.connect(this.chorusDepth);
    this.chorusDepth.connect(this.chorusDelay.delayTime);
    this.lfo.connect(this.flangerDepth);
    this.flangerDepth.connect(this.flangerDelay.delayTime);
    this.phaserFilters.forEach((filter, index) => {
      this.lfo.connect(this.phaserDepths[index]);
      this.phaserDepths[index].connect(filter.frequency);
    });
    this.lfo.connect(this.tremoloDepth);
    this.tremoloDepth.connect(this.tremoloGain.gain);
    this.lfo.connect(this.vibratoDepth);
    this.vibratoDepth.connect(this.vibratoDelay.delayTime);

    this.toneFilter.type = 'lowpass';
    this.toneFilter.Q.value = 0.6;
    this.leftWidthDelay.delayTime.value = 0.003;
    this.rightWidthDelay.delayTime.value = 0.009;
    this.phaserFeedbackDelay.delayTime.value = 0.001;

    this.nodes.push(
      this.lfo,
      this.chorusDelay,
      this.chorusDepth,
      this.chorusGain,
      this.flangerDelay,
      this.flangerDepth,
      this.flangerFeedback,
      this.flangerGain,
      ...this.phaserFilters,
      ...this.phaserDepths,
      this.phaserFeedback,
      this.phaserFeedbackDelay,
      this.phaserGain,
      this.tremoloGain,
      this.tremoloDepth,
      this.tremoloModeGain,
      this.vibratoDelay,
      this.vibratoDepth,
      this.vibratoGain,
      this.modeMixer,
      this.toneFilter,
      this.centerGain,
      this.widthGain,
      this.leftWidthDelay,
      this.rightWidthDelay,
      this.widthMerger,
    );
  }

  private registerParams() {
    this.paramHandlers.set('mode', (value) => {
      this.mode = readMode(value);
      this.applyMode();
      this.applyDepth();
      this.applyFeedback();
      this.applyTone();
    });
    this.paramHandlers.set('rate', (value) => {
      this.rate = clamp(asNumber(value, 0.85), 0.05, 20);
      this.applyRate();
    });
    this.paramHandlers.set('depth', (value) => {
      this.depth = clamp(asNumber(value, 44), 0, 100);
      this.applyDepth();
    });
    this.paramHandlers.set('feedback', (value) => {
      this.feedback = clamp(asNumber(value, 0.18), 0, 0.95);
      this.applyFeedback();
    });
    this.paramHandlers.set('mix', (value) => {
      const numberValue = asNumber(value, 42);
      this.setMix(numberValue <= 1 ? numberValue : percentToUnit(numberValue, 42));
    });
    this.paramHandlers.set('tone', (value) => {
      this.tone = clamp(asNumber(value, 68), 0, 100);
      this.applyTone();
    });
    this.paramHandlers.set('stereoWidth', (value) => {
      this.stereoWidth = clamp(asNumber(value, 52), 0, 100);
      this.applyWidth();
    });
    this.paramHandlers.set('sync', (value) => {
      this.sync = value === true;
      this.applyRate();
    });
    this.paramHandlers.set('bpm', (value) => {
      this.bpm = clamp(asNumber(value, 120), 40, 240);
      this.applyRate();
    });
    this.paramHandlers.set('division', (value) => {
      this.division = readDivision(value);
      this.applyRate();
    });
  }

  private applyAll(smooth = true) {
    this.applyMode(smooth);
    this.applyRate(smooth);
    this.applyDepth(smooth);
    this.applyFeedback(smooth);
    this.applyTone(smooth);
    this.applyWidth(smooth);
  }

  private applyMode(smooth = true) {
    const modeTargets: Record<ModulationMode, GainNode> = {
      chorus: this.chorusGain,
      flanger: this.flangerGain,
      phaser: this.phaserGain,
      tremolo: this.tremoloModeGain,
      vibrato: this.vibratoGain,
    };

    Object.entries(modeTargets).forEach(([mode, gain]) => {
      this.setAudioParam(gain.gain, mode === this.mode ? 1 : 0, smooth ? 0.018 : 0);
    });
  }

  private applyRate(smooth = true) {
    this.setAudioParam(this.lfo.frequency, this.getEffectiveRate(), smooth ? 0.025 : 0);
  }

  private applyDepth(smooth = true) {
    const unit = percentToUnit(this.depth, 44);
    const chorusBase = this.mode === 'chorus' ? 0.012 : 0.01;
    const flangerBase = this.mode === 'flanger' ? 0.0062 : 0.0048;
    const vibratoBase = this.mode === 'vibrato' ? 0.0075 : 0.006;

    this.setAudioParam(this.chorusDelay.delayTime, chorusBase, smooth ? 0.018 : 0);
    this.setAudioParam(this.chorusDepth.gain, 0.001 + unit * 0.011, smooth ? 0.018 : 0);
    this.setAudioParam(this.flangerDelay.delayTime, flangerBase, smooth ? 0.018 : 0);
    this.setAudioParam(this.flangerDepth.gain, 0.0001 + unit * 0.0058, smooth ? 0.018 : 0);
    this.setAudioParam(this.vibratoDelay.delayTime, vibratoBase, smooth ? 0.018 : 0);
    this.setAudioParam(this.vibratoDepth.gain, 0.0001 + unit * 0.0072, smooth ? 0.018 : 0);
    this.setAudioParam(this.tremoloGain.gain, 1 - unit * 0.5, smooth ? 0.018 : 0);
    this.setAudioParam(this.tremoloDepth.gain, unit * 0.5, smooth ? 0.018 : 0);

    this.phaserFilters.forEach((filter, index) => {
      const base = 360 + index * 270;
      this.setAudioParam(filter.frequency, base, smooth ? 0.018 : 0);
      this.setAudioParam(this.phaserDepths[index].gain, unit * (180 + index * 70), smooth ? 0.018 : 0);
      this.setAudioParam(filter.Q, 0.75 + unit * 1.25, smooth ? 0.018 : 0);
    });
  }

  private applyFeedback(smooth = true) {
    const feedback = clamp(this.feedback, 0, 0.95);
    this.setAudioParam(this.flangerFeedback.gain, this.mode === 'flanger' ? feedback * 0.86 : feedback * 0.28, smooth ? 0.018 : 0);
    this.setAudioParam(this.phaserFeedback.gain, this.mode === 'phaser' ? feedback * 0.58 : feedback * 0.18, smooth ? 0.018 : 0);
  }

  private applyTone(smooth = true) {
    const unit = percentToUnit(this.tone, 68);
    const ceiling = this.mode === 'flanger' ? 7800 : this.mode === 'vibrato' ? 10500 : 9200;
    const frequency = 1100 + unit ** 1.35 * (ceiling - 1100);
    this.setAudioParam(this.toneFilter.frequency, frequency, smooth ? 0.018 : 0);
  }

  private applyWidth(smooth = true) {
    const width = percentToUnit(this.stereoWidth, 52);
    this.setAudioParam(this.centerGain.gain, 1 - width * 0.5, smooth ? 0.018 : 0);
    this.setAudioParam(this.widthGain.gain, width * 0.58, smooth ? 0.018 : 0);
  }

  private getEffectiveRate() {
    if (this.sync) {
      return clamp(bpmToModRateHz(this.bpm, this.division), 0.05, 20);
    }

    return clamp(this.rate, 0.05, 20);
  }

  private setAudioParam(param: AudioParam, value: number, seconds: number) {
    if (seconds <= 0) {
      param.setValueAtTime(value, this.context.currentTime);
      return;
    }

    smoothParam(this.context, param, value, seconds);
  }
}

export const bpmToModRateHz = (bpm: number, division: ModulationDivision) => {
  const quarterSeconds = 60 / clamp(bpm, 40, 240);

  if (division === '1/1') {
    return 1 / (quarterSeconds * 4);
  }

  if (division === '1/2') {
    return 1 / (quarterSeconds * 2);
  }

  if (division === '1/8') {
    return 1 / (quarterSeconds / 2);
  }

  if (division === 'dotted1/8') {
    return 1 / (quarterSeconds * 0.75);
  }

  if (division === '1/16') {
    return 1 / (quarterSeconds / 4);
  }

  return 1 / quarterSeconds;
};

export const modulationModeLabel = (mode: ModulationMode) => {
  if (mode === 'tremolo') {
    return 'Tremolo';
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

const readMode = (value: PedalParamValue): ModulationMode => {
  if (value === 'chorus' || value === 'flanger' || value === 'phaser' || value === 'tremolo' || value === 'vibrato') {
    return value;
  }

  return 'chorus';
};

const readDivision = (value: PedalParamValue): ModulationDivision => {
  if (value === '1/1' || value === '1/2' || value === '1/4' || value === '1/8' || value === 'dotted1/8' || value === '1/16') {
    return value;
  }

  return '1/4';
};
