import { PedalParamValue } from '../types';
import { BaseEffect } from './BaseEffect';

export type CabinetType = '1x12' | '2x12' | '4x12' | 'openBack' | 'custom';
export type CabinetMic = 'dynamic' | 'ribbon' | 'condenser' | 'mixed';

type CustomIR = {
  name: string;
  data: ArrayBuffer;
  version: number;
};

type CabinetLane = {
  lowCut: BiquadFilterNode;
  convolver: ConvolverNode;
  highCut: BiquadFilterNode;
  levelGain: GainNode;
  laneGain: GainNode;
};

const customIRs = new Map<string, CustomIR>();

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

const safeDisconnect = (node: AudioNode) => {
  try {
    node.disconnect();
  } catch {
    // The node may already be disconnected during IR crossfades or shutdown.
  }
};

export const registerCustomCabinetIR = (id: string, name: string, data: ArrayBuffer) => {
  const version = Date.now();
  customIRs.set(id, { name, data, version });
  return `${name}:${version}`;
};

export class CabinetIREffect extends BaseEffect {
  private cabinetType: CabinetType = '2x12';
  private mic: CabinetMic = 'dynamic';
  private lowCutFrequency = 80;
  private highCutFrequency = 6500;
  private level = 72;
  private activeLane: CabinetLane;
  private loadToken = 0;
  private crossfadeTimer = 0;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'cabinetIR');
    this.activeLane = this.createLane(createSyntheticCabinetImpulse(context, this.cabinetType, this.mic), 1);
    this.setMix(1);
    this.applyLaneParams(this.activeLane, false);
    void this.loadCabinetBuffer();

    this.paramHandlers.set('cabinetType', (value) => {
      this.cabinetType = readCabinetType(value);
      void this.loadCabinetBuffer();
    });
    this.paramHandlers.set('cabinet', (value) => {
      this.cabinetType = readLegacyCabinetType(value);
      void this.loadCabinetBuffer();
    });
    this.paramHandlers.set('mic', (value) => {
      this.mic = readMic(value);
      void this.loadCabinetBuffer();
    });
    this.paramHandlers.set('customIRName', () => {
      this.cabinetType = 'custom';
      void this.loadCabinetBuffer();
    });
    this.paramHandlers.set('lowCut', (value) => {
      this.lowCutFrequency = clamp(asNumber(value, 80), 40, 200);
      smoothParam(context, this.activeLane.lowCut.frequency, this.lowCutFrequency, 0.018);
    });
    this.paramHandlers.set('highCut', (value) => {
      this.highCutFrequency = clamp(asNumber(value, 6500), 3000, 12000);
      smoothParam(context, this.activeLane.highCut.frequency, this.highCutFrequency, 0.018);
    });
    this.paramHandlers.set('mix', (value) => {
      const numberValue = asNumber(value, 100);
      this.setMix(numberValue <= 1 ? numberValue : percentToUnit(numberValue, 100));
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

  private async loadCabinetBuffer() {
    const token = ++this.loadToken;
    const buffer = await this.resolveCabinetBuffer();

    if (token !== this.loadToken) {
      return;
    }

    this.crossfadeTo(buffer);
  }

  private async resolveCabinetBuffer() {
    const customIR = customIRs.get(this.id);

    if (this.cabinetType === 'custom' && customIR) {
      try {
        return await this.context.decodeAudioData(customIR.data.slice(0));
      } catch {
        return createSyntheticCabinetImpulse(this.context, 'openBack', this.mic);
      }
    }

    const url = cabinetTypeToUrl(this.cabinetType);
    if (!url) {
      return createSyntheticCabinetImpulse(this.context, this.cabinetType, this.mic);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`IR not found: ${url}`);
      }

      const data = await response.arrayBuffer();
      return await this.context.decodeAudioData(data);
    } catch {
      return createSyntheticCabinetImpulse(this.context, this.cabinetType, this.mic);
    }
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
    previousLane.laneGain.gain.linearRampToValueAtTime(0, now + 0.045);
    nextLane.laneGain.gain.linearRampToValueAtTime(1, now + 0.045);

    window.clearTimeout(this.crossfadeTimer);
    this.crossfadeTimer = window.setTimeout(() => this.disposeLane(previousLane), 70);
  }

  private createLane(buffer: AudioBuffer, gain: number): CabinetLane {
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

    this.wetInput.connect(lowCut);
    lowCut.connect(convolver);
    convolver.connect(highCut);
    highCut.connect(levelGain);
    levelGain.connect(laneGain);
    laneGain.connect(this.wetOutput);

    return { lowCut, convolver, highCut, levelGain, laneGain };
  }

  private applyLaneParams(lane: CabinetLane, smooth = true) {
    const seconds = smooth ? 0.018 : 0;
    this.setAudioParam(lane.lowCut.frequency, this.lowCutFrequency, seconds);
    this.setAudioParam(lane.lowCut.Q, 0.707, seconds);
    this.setAudioParam(lane.highCut.frequency, this.highCutFrequency, seconds);
    this.setAudioParam(lane.highCut.Q, 0.82, seconds);
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

  private disposeLane(lane: CabinetLane) {
    safeDisconnect(lane.lowCut);
    safeDisconnect(lane.convolver);
    safeDisconnect(lane.highCut);
    safeDisconnect(lane.levelGain);
    safeDisconnect(lane.laneGain);
  }
}

const cabinetTypeToUrl = (cabinetType: CabinetType) => {
  const baseUrl = import.meta.env.BASE_URL || '/';

  if (cabinetType === '1x12') {
    return `${baseUrl}irs/cab_1x12.wav`;
  }

  if (cabinetType === '2x12') {
    return `${baseUrl}irs/cab_2x12.wav`;
  }

  if (cabinetType === '4x12') {
    return `${baseUrl}irs/cab_4x12.wav`;
  }

  return null;
};

const readCabinetType = (value: PedalParamValue): CabinetType => {
  if (value === '1x12' || value === '2x12' || value === '4x12' || value === 'openBack' || value === 'custom') {
    return value;
  }

  return '2x12';
};

const readLegacyCabinetType = (value: PedalParamValue): CabinetType => {
  if (typeof value !== 'string') {
    return '2x12';
  }

  if (value.includes('1x12')) {
    return '1x12';
  }

  if (value.includes('4x12')) {
    return '4x12';
  }

  return '2x12';
};

const readMic = (value: PedalParamValue): CabinetMic => {
  if (value === 'dynamic' || value === 'ribbon' || value === 'condenser' || value === 'mixed') {
    return value;
  }

  return 'dynamic';
};

const createSyntheticCabinetImpulse = (context: AudioContext, cabinetType: CabinetType, mic: CabinetMic) => {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * syntheticLengthSeconds(cabinetType));
  const buffer = context.createBuffer(2, length, sampleRate);
  const lowEnd = syntheticLowEnd(cabinetType);
  const micBrightness = syntheticMicBrightness(mic);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);

    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      const envelope = Math.exp(-time * (26 - lowEnd * 5));
      const earlyReflection = index < sampleRate * 0.006 ? 1 - index / (sampleRate * 0.006) : 0;
      const seed = seededNoise(index, channel);
      const cone = Math.sin(2 * Math.PI * (105 + lowEnd * 55) * time) * 0.38;
      const paper = Math.sin(2 * Math.PI * (1750 + micBrightness * 1200) * time) * 0.08;
      const air = seed * (0.38 + micBrightness * 0.28);
      data[index] = (cone + paper + air + earlyReflection * 0.9) * envelope;
    }
  }

  return buffer;
};

const syntheticLengthSeconds = (cabinetType: CabinetType) => {
  if (cabinetType === '1x12') {
    return 0.055;
  }

  if (cabinetType === '4x12') {
    return 0.085;
  }

  if (cabinetType === 'openBack') {
    return 0.095;
  }

  return 0.07;
};

const syntheticLowEnd = (cabinetType: CabinetType) => {
  if (cabinetType === '1x12') {
    return 0.35;
  }

  if (cabinetType === '4x12') {
    return 0.85;
  }

  if (cabinetType === 'openBack') {
    return 0.52;
  }

  return 0.62;
};

const syntheticMicBrightness = (mic: CabinetMic) => {
  if (mic === 'ribbon') {
    return 0.28;
  }

  if (mic === 'condenser') {
    return 0.88;
  }

  if (mic === 'mixed') {
    return 0.62;
  }

  return 0.5;
};

const seededNoise = (index: number, channel: number) => {
  const value = Math.sin((index + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};
