import { AmpEQEffect } from './nodes/AmpEQEffect';
import {
  PedalUnit,
  applyPedalParams,
  applyPedalState,
  createPedalUnit,
  disconnectPedalUnit,
} from './nodes/BaseEffect';
import { CabinetIREffect } from './nodes/CabinetIREffect';
import { CompressorEffect } from './nodes/CompressorEffect';
import { DelayEffect } from './nodes/DelayEffect';
import { DriveEffect } from './nodes/DriveEffect';
import { MeterNode } from './nodes/MeterNode';
import { NoiseGateEffect } from './nodes/NoiseGateEffect';
import { ReverbEffect } from './nodes/ReverbEffect';
import { TunerNode } from './nodes/TunerNode';
import { MeterReading, Pedal, TunerReading } from './types';
import { clamp } from './utils/curves';
import { rampAudioParam, safeDisconnect, smoothAudioParam } from './utils/smoothing';
import driveWorkletSource from './worklets/drive-processor.ts?raw';
import looperWorkletSource from './worklets/looper-processor.ts?raw';
import noiseGateWorkletSource from './worklets/noise-gate-processor.ts?raw';
import pitchDetectorWorkletSource from './worklets/pitch-detector-processor.ts?raw';

const WORKLET_MODULE_SOURCES = [
  noiseGateWorkletSource,
  driveWorkletSource,
  looperWorkletSource,
  pitchDetectorWorkletSource,
];

const emptyMeter: MeterReading = { rms: 0, peak: 0, db: -120 };
const emptyTuner: TunerReading = { note: '--', frequency: null, cents: 0, confidence: 0 };

const formatConstraintDevice = (deviceId?: string): MediaStreamConstraints => ({
  audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  },
});

export class AudioEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private inputMeter: MeterNode | null = null;
  private outputMeter: MeterNode | null = null;
  private tuner: TunerNode | null = null;
  private masterGain: GainNode | null = null;
  private units = new Map<string, PedalUnit>();
  private masterVolume = 0.82;
  private pendingRebuild = 0;
  private currentPedals: Pedal[] = [];

  get isReady() {
    return Boolean(this.context && this.source && this.masterGain);
  }

  get sampleRate() {
    return this.context?.sampleRate ?? 44100;
  }

  async connect(deviceId: string | undefined, pedals: Pedal[], masterVolume: number) {
    await this.ensureContext();
    this.masterVolume = masterVolume;
    await this.replaceInputStream(deviceId);
    this.rebuildChain(pedals, true);
    await this.context?.resume();
  }

  async switchInput(deviceId: string | undefined, pedals: Pedal[]) {
    if (!this.context) {
      return;
    }

    this.fadeMaster(0, 0.02);
    await new Promise((resolve) => window.setTimeout(resolve, 24));
    await this.replaceInputStream(deviceId);
    this.rebuildChain(pedals, true);
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clamp(volume, 0, 1.25);
    if (!this.context || !this.masterGain) {
      return;
    }

    smoothAudioParam(this.context, this.masterGain.gain, this.masterVolume, 0.015);
  }

  updatePedal(pedal: Pedal) {
    const unit = this.units.get(pedal.id);
    if (!unit || !this.context) {
      return;
    }

    applyPedalState(this.context, unit, pedal);
    applyPedalParams(this.context, unit, pedal);
  }

  rebuildChain(pedals: Pedal[], skipFade = false) {
    this.currentPedals = pedals.map((pedal) => ({ ...pedal, params: { ...pedal.params } }));

    if (!this.context || !this.source || !this.masterGain || !this.inputMeter || !this.outputMeter || !this.tuner) {
      return;
    }

    if (this.pendingRebuild) {
      window.clearTimeout(this.pendingRebuild);
      this.pendingRebuild = 0;
    }

    const reconnect = () => {
      if (!this.context || !this.source || !this.masterGain || !this.inputMeter || !this.outputMeter || !this.tuner) {
        return;
      }

      this.disconnectGraph();
      this.units.clear();

      this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
      this.source.connect(this.inputMeter.input);
      this.inputMeter.output.connect(this.tuner.input);

      let previous: AudioNode = this.tuner.output;
      pedals.forEach((pedal) => {
        const core = this.createEffectCore(pedal);
        const unit = createPedalUnit(this.context as AudioContext, pedal, core);
        previous.connect(unit.input);
        previous = unit.output;
        this.units.set(pedal.id, unit);
      });

      previous.connect(this.masterGain);
      this.masterGain.connect(this.outputMeter.input);
      this.outputMeter.output.connect(this.context.destination);
      this.fadeMaster(this.masterVolume, 0.02);
    };

    if (skipFade) {
      reconnect();
      return;
    }

    this.fadeMaster(0, 0.02);
    this.pendingRebuild = window.setTimeout(() => {
      this.pendingRebuild = 0;
      reconnect();
    }, 24);
  }

  panic(pedals = this.currentPedals) {
    if (!this.context || !this.masterGain) {
      return;
    }

    this.fadeMaster(0, 0.012);
    window.setTimeout(() => this.rebuildChain(pedals, true), 28);
  }

  readInputMeter(): MeterReading {
    return this.inputMeter?.read() ?? emptyMeter;
  }

  readOutputMeter(): MeterReading {
    return this.outputMeter?.read() ?? emptyMeter;
  }

  readTuner(): TunerReading {
    return this.tuner?.read() ?? emptyTuner;
  }

  dispose() {
    window.clearTimeout(this.pendingRebuild);
    this.disconnectGraph();
    this.stopStream();
    this.context?.close();
    this.context = null;
  }

  private async ensureContext() {
    if (this.context) {
      return;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextConstructor({ latencyHint: 'interactive' });
    await this.registerWorklets(this.context);

    this.inputMeter = new MeterNode(this.context, 2048, 0.72);
    this.outputMeter = new MeterNode(this.context, 2048, 0.78);
    this.tuner = new TunerNode(this.context);
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0;
  }

  private async replaceInputStream(deviceId?: string) {
    if (!this.context) {
      return;
    }

    this.stopStream();
    this.stream = await navigator.mediaDevices.getUserMedia(formatConstraintDevice(deviceId));
    this.source = this.context.createMediaStreamSource(this.stream);
  }

  private async registerWorklets(context: AudioContext) {
    const urls = WORKLET_MODULE_SOURCES.map((source) =>
      URL.createObjectURL(new Blob([source], { type: 'text/javascript' })),
    );

    try {
      await Promise.all(urls.map((url) => context.audioWorklet.addModule(url)));
    } finally {
      urls.forEach((url) => URL.revokeObjectURL(url));
    }
  }

  private stopStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    safeDisconnect(this.source);
    this.source = null;
  }

  private disconnectGraph() {
    safeDisconnect(this.source);
    safeDisconnect(this.inputMeter?.input);
    safeDisconnect(this.tuner?.input);
    safeDisconnect(this.masterGain);
    safeDisconnect(this.outputMeter?.input);
    this.units.forEach(disconnectPedalUnit);
  }

  private createEffectCore(pedal: Pedal) {
    if (!this.context) {
      throw new Error('Audio context is not ready.');
    }

    if (pedal.type === 'noiseGate') {
      return new NoiseGateEffect(this.context).create(pedal);
    }

    if (pedal.type === 'compressor') {
      return new CompressorEffect(this.context).create(pedal);
    }

    if (pedal.type === 'drive') {
      return new DriveEffect(this.context).create(pedal);
    }

    if (pedal.type === 'ampEq') {
      return new AmpEQEffect(this.context).create(pedal);
    }

    if (pedal.type === 'cabinet') {
      return new CabinetIREffect(this.context).create(pedal);
    }

    if (pedal.type === 'delay') {
      return new DelayEffect(this.context).create(pedal);
    }

    if (pedal.type === 'reverb') {
      return new ReverbEffect(this.context).create(pedal);
    }

    throw new Error(`Unknown effect type: ${pedal.type}`);
  }

  private fadeMaster(value: number, seconds: number) {
    if (!this.context || !this.masterGain) {
      return;
    }

    rampAudioParam(this.context, this.masterGain.gain, value, seconds);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
