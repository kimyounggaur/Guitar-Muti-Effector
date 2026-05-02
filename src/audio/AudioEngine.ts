import { MeterNode, MeterReading, emptyMeterReading } from './nodes/MeterNode';
import { Pedal } from './types';

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

  rebuildChain(_pedals: Pedal[]) {
    // Effects are not connected yet. This hook is intentionally reserved for the DSP chain step.
  }

  async stop() {
    this.stopTracks();
    this.disconnectNodes();

    if (this.audioContext) {
      await this.audioContext.close();
    }

    this.audioContext = null;
    this.masterGain = null;
    this.inputMeter = null;
    this.outputMeter = null;
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

    this.masterGain.gain.setValueAtTime(masterVolume, this.audioContext.currentTime);
    this.source.connect(this.inputMeter.input);
    this.inputMeter.output.connect(this.masterGain);
    this.masterGain.connect(this.outputMeter.input);
    this.outputMeter.output.connect(this.audioContext.destination);
  }

  private stopTracks() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private disconnectNodes() {
    safeDisconnect(this.source);
    safeDisconnect(this.masterGain);
    safeDisconnect(this.inputMeter?.input ?? null);
    safeDisconnect(this.outputMeter?.input ?? null);
    this.source = null;
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
