import { PassthroughEffect } from './nodes/BaseEffect';
import { AmpEQEffect } from './nodes/AmpEQEffect';
import { CabinetIREffect } from './nodes/CabinetIREffect';
import { CompressorEffect, prepareCompressor } from './nodes/CompressorEffect';
import { DelayEffect } from './nodes/DelayEffect';
import { DriveEffect } from './nodes/DriveEffect';
import { LooperNode } from './nodes/LooperNode';
import { MeterNode, MeterReading, emptyMeterReading } from './nodes/MeterNode';
import { ModulationEffect } from './nodes/ModulationEffect';
import { NoiseGateEffect, prepareNoiseGate } from './nodes/NoiseGateEffect';
import { ReverbEffect } from './nodes/ReverbEffect';
import { RhythmNode } from './nodes/RhythmNode';
import { createSafetyLimiter, prepareSafetyLimiter } from './nodes/SafetyLimiterEffect';
import { TunerNode } from './nodes/TunerNode';
import { EffectNodeWrapper, Pedal, PedalParamValue, PedalType } from './types';

export type AudioEngineState = {
  sampleRate: number;
  latencyHint: string;
};

export type InputChannel = '1' | '2' | 'mix';

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
  private inputSplitter: ChannelSplitterNode | null = null;
  private inputLeft: GainNode | null = null;
  private inputRight: GainNode | null = null;
  private inputMono: GainNode | null = null;
  private inputChannel: InputChannel = '1';
  private mediaElement: HTMLMediaElement | null = null;
  private mediaElementSource: MediaElementAudioSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private presetTrimGain: GainNode | null = null;
  private presetTrimDb = 0;
  private safetyLimiter: AudioWorkletNode | null = null;
  private chainOutput: GainNode | null = null;
  private inputMeter: MeterNode | null = null;
  private outputMeter: MeterNode | null = null;
  private effectMap = new Map<string, EffectNodeWrapper>();
  private currentChainKey = '';
  private currentPedalParams = new Map<string, Record<string, PedalParamValue>>();
  private currentMasterVolume = 0.35;
  private errorHandler: ((message: string) => void) | null = null;
  private inputEndedHandler: (() => void) | null = null;
  private trackListeners: Array<{ track: MediaStreamTrack; handler: () => void }> = [];
  private pendingRebuildTimer = 0;
  private operationGeneration = 0;
  private readonly latencyHint: AudioContextLatencyCategory = 'interactive';

  get isReady() {
    return Boolean(this.audioContext && this.masterGain && (this.stream || this.mediaElementSource));
  }

  async connect(selectedDeviceId: string, masterVolume: number): Promise<AudioEngineState> {
    const generation = ++this.operationGeneration;
    await this.ensureContext(generation);
    await this.replaceStream(selectedDeviceId, generation);
    this.assertCurrent(generation);
    this.rebuildPassThrough(masterVolume);
    await this.audioContext?.resume();
    this.assertCurrent(generation);

    return {
      sampleRate: this.audioContext?.sampleRate ?? 0,
      latencyHint: this.outputLatencyLabel(),
    };
  }

  async switchDevice(selectedDeviceId: string, masterVolume: number): Promise<AudioEngineState> {
    if (!this.audioContext) {
      return this.connect(selectedDeviceId, masterVolume);
    }

    const generation = ++this.operationGeneration;
    await this.replaceStream(selectedDeviceId, generation);
    this.assertCurrent(generation);
    this.rebuildPassThrough(masterVolume);

    return {
      sampleRate: this.audioContext.sampleRate,
      latencyHint: this.outputLatencyLabel(),
    };
  }

  async connectUploadedAudio(
    mediaElement: HTMLMediaElement,
    masterVolume: number,
    pedals: Pedal[],
  ): Promise<AudioEngineState> {
    const generation = ++this.operationGeneration;
    await this.ensureContext(generation);
    this.assertCurrent(generation);

    if (!this.audioContext || !this.masterGain) {
      throw new Error('AudioContext is not ready.');
    }

    if (this.mediaElement !== mediaElement) {
      safeDisconnect(this.mediaElementSource);
      this.mediaElementSource = this.audioContext.createMediaElementSource(mediaElement);
      this.mediaElement = mediaElement;
      // A newly introduced source needs graph wiring even if the pedal order is unchanged.
      this.currentChainKey = '';
    }

    this.currentMasterVolume = masterVolume;
    this.masterGain.gain.setValueAtTime(masterVolume, this.audioContext.currentTime);
    this.rebuildChain(pedals);
    await this.audioContext.resume();
    this.assertCurrent(generation);

    return {
      sampleRate: this.audioContext.sampleRate,
      latencyHint: this.outputLatencyLabel(),
    };
  }

  private outputLatencyLabel() {
    const context = this.audioContext;
    if (!context || !Number.isFinite(context.baseLatency) || !Number.isFinite(context.outputLatency)) return '측정 불가';
    return `출력 추정 ${Math.round((context.baseLatency + context.outputLatency) * 1000)} ms`;
  }

  setMasterVolume(volume: number) {
    volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    this.currentMasterVolume = volume;

    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(volume, now, 0.015);
  }

  setPresetTrimDb(db: number) {
    this.presetTrimDb = Number.isFinite(db) ? Math.max(-36, Math.min(0, db)) : 0;
    if (this.presetTrimGain && this.audioContext) {
      const gain = this.presetTrimGain.gain;
      const now = this.audioContext.currentTime;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(10 ** (this.presetTrimDb / 20), now, 0.015);
    }
  }

  setInputChannel(channel: InputChannel) {
    this.inputChannel = channel;
    if (!this.audioContext || !this.inputLeft || !this.inputRight) return;
    const now = this.audioContext.currentTime;
    const left = channel === '2' ? 0 : channel === 'mix' ? 0.5 : 1;
    const right = channel === '1' ? 0 : channel === 'mix' ? 0.5 : 1;
    for (const [node, value] of [[this.inputLeft, left], [this.inputRight, right]] as const) {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(value, now, 0.01);
    }
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

  setInputEndedHandler(handler: (() => void) | null) {
    this.inputEndedHandler = handler;
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const context = this.audioContext;
    if (!context || context.state === 'closed') throw new Error('먼저 기타 또는 오디오 파일을 연결해 주세요.');
    const setSinkId = (context as AudioContext & { setSinkId?: (id: string) => Promise<void> }).setSinkId;
    if (!setSinkId) throw new Error('이 브라우저는 앱에서 출력 장치 선택을 지원하지 않습니다. 운영체제의 소리 설정에서 변경해 주세요.');
    const generation = this.operationGeneration;
    await setSinkId.call(context, deviceId || '');
    this.assertCurrent(generation);
    if (this.audioContext !== context) throw new DOMException('오디오 연결이 취소되었습니다.', 'AbortError');
  }

  rebuildChain(pedals: Pedal[]) {
    if (!this.audioContext || !this.masterGain || !this.inputMeter || !this.outputMeter || !this.hasInputSource()) {
      return;
    }

    const chainKey = JSON.stringify(pedals.map(({ id, type }) => [id, type]));
    if (chainKey === this.currentChainKey && !this.pendingRebuildTimer) {
      // Ordinary switches only change bypass: keep the graph and effect tails alive.
      pedals.forEach((pedal) => {
        const effect = this.effectMap.get(pedal.id);
        if (!effect) return;
        const previousParams = this.currentPedalParams.get(pedal.id) ?? {};
        Object.entries(pedal.params).forEach(([name, value]) => {
          if (previousParams[name] !== value) effect.setParam(name, value);
        });
        this.currentPedalParams.set(pedal.id, { ...pedal.params });
        effect.setBypass(!pedal.enabled || pedal.bypassed);
      });
      return;
    }

    window.clearTimeout(this.pendingRebuildTimer);
    this.fadeMaster(0, 0.02);

    this.pendingRebuildTimer = window.setTimeout(() => {
      this.pendingRebuildTimer = 0;
      try {
        if (!this.audioContext || !this.masterGain || !this.inputMeter || !this.outputMeter || !this.hasInputSource()) {
          return;
        }

        this.disconnectAudioGraph();
        this.disposeMissingEffects(pedals);

        this.connectInputSources();
        let previousNode: AudioNode = this.inputMeter.output;

        this.currentPedalParams.clear();
        pedals.forEach((pedal) => {
          const effect = this.getOrCreateEffect(pedal.type, pedal.id);
          Object.entries(pedal.params).forEach(([name, value]) => effect.setParam(name, value));
          effect.setBypass(!pedal.enabled || pedal.bypassed);
          this.currentPedalParams.set(pedal.id, { ...pedal.params });
          previousNode.connect(effect.input);
          previousNode = effect.output;
        });
        this.currentChainKey = chainKey;

        if (this.chainOutput) previousNode.connect(this.chainOutput);
        this.connectSafeOutput();
        this.fadeMaster(this.currentMasterVolume, 0.02);
      } catch (error) {
        this.panicDisconnect();
        this.errorHandler?.(error instanceof Error ? error.message : 'Could not rebuild audio chain.');
      }
    }, 24);
  }

  setPedalParam(pedalId: string, paramName: string, value: PedalParamValue) {
    this.effectMap.get(pedalId)?.setParam(paramName, value);
    const params = this.currentPedalParams.get(pedalId);
    if (params && !paramName.startsWith('__')) params[paramName] = value;
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
    this.operationGeneration++;
    window.clearTimeout(this.pendingRebuildTimer);
    this.pendingRebuildTimer = 0;
    this.currentMasterVolume = 0;
    this.mediaElement?.pause();
    this.stopTracks();

    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    }

    this.disconnectAudioGraph();
  }

  async stop() {
    this.operationGeneration++;
    window.clearTimeout(this.pendingRebuildTimer);
    this.pendingRebuildTimer = 0;
    this.stopTracks();
    this.disconnectNodes();

    const oldContext = this.audioContext;
    this.audioContext = null;
    this.masterGain = null;
    this.presetTrimGain = null;
    this.safetyLimiter = null;
    this.chainOutput = null;
    this.inputMeter = null;
    this.outputMeter = null;
    this.inputSplitter = null;
    this.inputLeft = null;
    this.inputRight = null;
    this.inputMono = null;
    this.mediaElement = null;
    this.mediaElementSource = null;
    this.effectMap.forEach((effect) => effect.dispose());
    this.effectMap.clear();
    if (oldContext && oldContext.state !== 'closed') await oldContext.close();
  }

  private assertCurrent(generation: number) {
    if (generation !== this.operationGeneration) throw new DOMException('오디오 연결이 취소되었습니다.', 'AbortError');
  }

  private async ensureContext(generation: number) {
    if (this.audioContext) {
      return;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextConstructor({ latencyHint: this.latencyHint });
    this.audioContext = context;
    try {
      await Promise.all([prepareNoiseGate(context), prepareCompressor(context), prepareSafetyLimiter(context)]);
      this.assertCurrent(generation);
      if (this.audioContext !== context) throw new DOMException('오디오 연결이 취소되었습니다.', 'AbortError');
    } catch (error) {
      if (this.audioContext === context) this.audioContext = null;
      if (context.state !== 'closed') await context.close().catch(() => {});
      throw error;
    }
    this.masterGain = this.audioContext.createGain();
    this.presetTrimGain = this.audioContext.createGain();
    this.presetTrimGain.gain.value = 10 ** (this.presetTrimDb / 20);
    this.safetyLimiter = createSafetyLimiter(this.audioContext);
    this.chainOutput = this.audioContext.createGain();
    this.inputMeter = new MeterNode(this.audioContext);
    this.outputMeter = new MeterNode(this.audioContext);
    this.inputSplitter = this.audioContext.createChannelSplitter(2);
    this.inputLeft = this.audioContext.createGain();
    this.inputRight = this.audioContext.createGain();
    this.inputMono = this.audioContext.createGain();
    this.inputMono.channelCount = 1;
    this.inputMono.channelCountMode = 'explicit';
    this.inputSplitter.connect(this.inputLeft, 0);
    this.inputSplitter.connect(this.inputRight, 1);
    this.inputLeft.connect(this.inputMono);
    this.inputRight.connect(this.inputMono);
    this.setInputChannel(this.inputChannel);
  }

  private async replaceStream(selectedDeviceId: string, generation: number) {
    if (!this.audioContext) {
      throw new Error('AudioContext is not ready.');
    }

    this.stopTracks();
    this.disconnectNodes();

    const context = this.audioContext;
    const stream = await navigator.mediaDevices.getUserMedia(createInputConstraints(selectedDeviceId));
    if (generation !== this.operationGeneration || this.audioContext !== context) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException('오디오 연결이 취소되었습니다.', 'AbortError');
    }
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    for (const track of stream.getAudioTracks()) {
      const handler = () => {
        // Ignore events from obsolete streams and stops initiated by the app.
        if (this.stream !== stream) return;
        this.panicDisconnect();
        this.inputEndedHandler?.();
      };
      track.addEventListener('ended', handler);
      this.trackListeners.push({ track, handler });
    }
  }

  private rebuildPassThrough(masterVolume: number) {
    if (!this.audioContext || !this.masterGain || !this.inputMeter || !this.outputMeter || !this.hasInputSource()) {
      return;
    }

    this.currentMasterVolume = masterVolume;
    this.masterGain.gain.setValueAtTime(masterVolume, this.audioContext.currentTime);
    this.connectInputSources();
    if (this.chainOutput) this.inputMeter.output.connect(this.chainOutput);
    this.connectSafeOutput();
  }

  private connectSafeOutput() {
    if (!this.chainOutput || !this.outputMeter || !this.presetTrimGain || !this.safetyLimiter || !this.masterGain || !this.audioContext) return;
    this.chainOutput.connect(this.presetTrimGain);
    this.presetTrimGain.connect(this.safetyLimiter);
    this.safetyLimiter.connect(this.masterGain);
    this.masterGain.connect(this.outputMeter.input);
    this.outputMeter.output.connect(this.audioContext.destination);
  }

  private stopTracks() {
    for (const { track, handler } of this.trackListeners) track.removeEventListener('ended', handler);
    this.trackListeners = [];
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private disconnectNodes() {
    this.disconnectAudioGraph();
    this.source = null;
  }

  private disconnectAudioGraph() {
    this.currentChainKey = '';
    this.currentPedalParams.clear();
    safeDisconnect(this.source);
    safeDisconnect(this.inputMono);
    safeDisconnect(this.mediaElementSource);
    safeDisconnect(this.inputMeter?.input ?? null);
    safeDisconnect(this.outputMeter?.input ?? null);
    safeDisconnect(this.presetTrimGain);
    safeDisconnect(this.safetyLimiter);
    safeDisconnect(this.chainOutput);
    safeDisconnect(this.masterGain);
    this.effectMap.forEach((effect) => effect.disconnect());
  }

  private hasInputSource() {
    return Boolean(this.source || this.mediaElementSource);
  }

  private connectInputSources() {
    if (!this.inputMeter) {
      return;
    }

    if (this.source) {
      if (this.inputSplitter && this.inputMono) {
        this.source.connect(this.inputSplitter);
        this.inputMono.connect(this.inputMeter.input);
      }
    }

    if (this.mediaElementSource) {
      this.mediaElementSource.connect(this.inputMeter.input);
    }
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

    if (type === 'noiseGate') {
      return new NoiseGateEffect(this.audioContext, id);
    }

    if (type === 'compressor') {
      return new CompressorEffect(this.audioContext, id);
    }

    if (type === 'tuner') {
      return new TunerNode(this.audioContext, id);
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

    if (type === 'looper') {
      return new LooperNode(this.audioContext, id);
    }

    if (type === 'rhythm') {
      return new RhythmNode(this.audioContext, id);
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
