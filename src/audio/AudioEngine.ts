import {
  ModulationEffect,
  PassthroughEffect,
} from './nodes/BaseEffect';
import { AmpEQEffect } from './nodes/AmpEQEffect';
import { CabinetIREffect } from './nodes/CabinetIREffect';
import { CompressorEffect } from './nodes/CompressorEffect';
import { DelayEffect } from './nodes/DelayEffect';
import { DriveEffect } from './nodes/DriveEffect';
import { MeterNode, MeterReading, emptyMeterReading } from './nodes/MeterNode';
import { ReverbEffect } from './nodes/ReverbEffect';
import { EffectNodeWrapper, Pedal, PedalParamValue, PedalType } from './types';

export type AudioEngineState = {
  sampleRate: number;
  latencyHint: AudioContextLatencyCategory;
};

const createInputConstraints = (deviceId: string): MediaStreamConstraints => ({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    deviceId: deviceId ? { exact: deviceId } : undefined,
  },
});

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private inputMeter: MeterNode | null = null;
  private outputMeter: MeterNode | null = null;
  private effectMap = new Map<string, EffectNodeWrapper>();
  private currentMasterVolume = 0.35;
  private errorHandler: ((message: string) => void) | null = null;
  private pendingRebuildTimer = 0;
  private readonly latencyHint: AudioContextLatencyCategory = 'interactive';

  get isReady() {
    return Boolean(this.audioContext && this.stream && this.masterGain);
  }

  async connect(selectedDeviceId: string, masterVolume: number): Promise<AudioEngineState> {
    await this.ensureContext();
    await this.replaceStream(selectedDeviceId);
    this.rebuildPassThrough(masterVolume);
    await this.audioContext?.resume();

    return {
      sampleRate: this.audioContext?.sampleRate ?? 0,
      latencyHint: this.latencyHint,
    };
  }

  async switchDevice(selectedDeviceId: string, masterVolume: number): Promise<AudioEngineState> {
    if (!this.audioContext) {
      return this.connect(selectedDeviceId, masterVolume);
    }

    await this.replaceStream(selectedDeviceId);
    this.rebuildPassThrough(masterVolume);

    return {
      sampleRate: this.audioContext.sampleRate,
      latencyHint: this.latencyHint,
    };
  }

  setMasterVolume(volume: number) {
    this.currentMasterVolume = volume;

    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(volume, now, 0.015);
  }

  readInputMeter(): MeterReading {
    return this.inputMeter?.read() ?? emptyMeterReading;
  }

  readOutputMeter(): MeterReading {
    return this.outputMeter?.read() ?? emptyMeterReading;
  }

  setErrorHandler(handler: ((message: string) => void) | null) {
    this.errorHandler = handler;
  }

  rebuildChain(pedals: Pedal[]) {
    if (!this.audioContext || !this.source || !this.masterGain || !this.inputMeter || !this.outputMeter) {
      return;
    }

    const previousVolume = this.currentMasterVolume;
    window.clearTimeout(this.pendingRebuildTimer);
    this.fadeMaster(0, 0.02);

    this.pendingRebuildTimer = window.setTimeout(() => {
      this.pendingRebuildTimer = 0;
      try {
        if (!this.audioContext || !this.source || !this.masterGain || !this.inputMeter || !this.outputMeter) {
          return;
        }

        this.disconnectAudioGraph();
        this.disposeMissingEffects(pedals);

        this.source.connect(this.inputMeter.input);
        let previousNode: AudioNode = this.inputMeter.output;

        pedals.forEach((pedal) => {
          if (!pedal.enabled) {
            return;
          }

          const effect = this.getOrCreateEffect(pedal.type, pedal.id);
          Object.entries(pedal.params).forEach(([name, value]) => effect.setParam(name, value));
          effect.setBypass(pedal.bypassed);
          previousNode.connect(effect.input);
          previousNode = effect.output;
        });

        previousNode.connect(this.outputMeter.input);
        this.outputMeter.output.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);
        this.fadeMaster(previousVolume, 0.02);
      } catch (error) {
        this.panicDisconnect();
        this.errorHandler?.(error instanceof Error ? error.message : 'Could not rebuild audio chain.');
      }
    }, 24);
  }

  setPedalParam(pedalId: string, paramName: string, value: PedalParamValue) {
    this.effectMap.get(pedalId)?.setParam(paramName, value);
  }

  setPedalBypass(pedalId: string, bypassed: boolean) {
    this.effectMap.get(pedalId)?.setBypass(bypassed);
  }

  disposeEffect(pedalId: string) {
    const effect = this.effectMap.get(pedalId);
    if (!effect) {
      return;
    }

    effect.dispose();
    this.effectMap.delete(pedalId);
  }

  panicDisconnect() {
    window.clearTimeout(this.pendingRebuildTimer);
    this.pendingRebuildTimer = 0;

    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    }

    this.disconnectAudioGraph();
  }

  async stop() {
    window.clearTimeout(this.pendingRebuildTimer);
    this.pendingRebuildTimer = 0;
    this.stopTracks();
    this.disconnectNodes();

    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.audioContext = null;
    this.masterGain = null;
    this.inputMeter = null;
    this.outputMeter = null;
    this.effectMap.forEach((effect) => effect.dispose());
    this.effectMap.clear();
  }

  private async ensureContext() {
    if (this.audioContext) {
      return;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextConstructor({ latencyHint: this.latencyHint });
    this.masterGain = this.audioContext.createGain();
    this.inputMeter = new MeterNode(this.audioContext);
    this.outputMeter = new MeterNode(this.audioContext);
  }

  private async replaceStream(selectedDeviceId: string) {
    if (!this.audioContext) {
      throw new Error('AudioContext is not ready.');
    }

    this.stopTracks();
    this.disconnectNodes();

    this.stream = await navigator.mediaDevices.getUserMedia(createInputConstraints(selectedDeviceId));
    this.source = this.audioContext.createMediaStreamSource(this.stream);
  }

  private rebuildPassThrough(masterVolume: number) {
    if (!this.audioContext || !this.source || !this.masterGain || !this.inputMeter || !this.outputMeter) {
      return;
    }

    this.currentMasterVolume = masterVolume;
    this.masterGain.gain.setValueAtTime(masterVolume, this.audioContext.currentTime);
    this.source.connect(this.inputMeter.input);
    this.inputMeter.output.connect(this.outputMeter.input);
    this.outputMeter.output.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);
  }

  private stopTracks() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private disconnectNodes() {
    this.disconnectAudioGraph();
    this.source = null;
  }

  private disconnectAudioGraph() {
    safeDisconnect(this.source);
    safeDisconnect(this.inputMeter?.input ?? null);
    safeDisconnect(this.outputMeter?.input ?? null);
    safeDisconnect(this.masterGain);
    this.effectMap.forEach((effect) => effect.disconnect());
  }

  private getOrCreateEffect(type: PedalType, id: string) {
    const existing = this.effectMap.get(id);
    if (existing && existing.type === type) {
      return existing;
    }

    if (existing) {
      existing.dispose();
    }

    const effect = this.createEffect(type, id);
    this.effectMap.set(id, effect);
    return effect;
  }

  private createEffect(type: PedalType, id: string): EffectNodeWrapper {
    if (!this.audioContext) {
      throw new Error('AudioContext is not ready.');
    }

    if (type === 'compressor') {
      return new CompressorEffect(this.audioContext, id);
    }

    if (type === 'drive') {
      return new DriveEffect(this.audioContext, id);
    }

    if (type === 'ampEQ') {
      return new AmpEQEffect(this.audioContext, id);
    }

    if (type === 'cabinetIR') {
      return new CabinetIREffect(this.audioContext, id);
    }

    if (type === 'delay') {
      return new DelayEffect(this.audioContext, id);
    }

    if (type === 'reverb') {
      return new ReverbEffect(this.audioContext, id);
    }

    if (type === 'modulation') {
      return new ModulationEffect(this.audioContext, id);
    }

    return new PassthroughEffect(this.audioContext, id, type);
  }

  private disposeMissingEffects(pedals: Pedal[]) {
    const ids = new Set(pedals.map((pedal) => pedal.id));
    this.effectMap.forEach((_effect, id) => {
      if (!ids.has(id)) {
        this.disposeEffect(id);
      }
    });
  }

  private fadeMaster(value: number, seconds: number) {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const now = this.audioContext.currentTime;
    const currentValue = this.masterGain.gain.value;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(currentValue, now);
    this.masterGain.gain.linearRampToValueAtTime(value, now + seconds);
  }
}

const safeDisconnect = (node: AudioNode | null) => {
  if (!node) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // The node may already be disconnected during device changes or shutdown.
  }
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
