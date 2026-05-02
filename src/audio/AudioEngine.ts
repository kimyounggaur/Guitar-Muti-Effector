import { EFFECT_DEFINITIONS, Pedal, getParamDefault } from './types';

export type MeterReading = {
  rms: number;
  peak: number;
  db: number;
};

export type TunerReading = {
  note: string;
  frequency: number | null;
  cents: number;
  confidence: number;
};

type FloatAudioBuffer = Float32Array<ArrayBuffer>;

type ParamControl = {
  param: AudioParam;
  transform?: (value: number) => number;
  timeConstant?: number;
};

type PedalUnit = {
  input: GainNode;
  output: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  levelGain: GainNode;
  controls: Map<string, ParamControl>;
  nodes: AudioNode[];
};

const WORKLET_URL = `${import.meta.env.BASE_URL}worklets/effects-worklet.js`;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const safeDisconnect = (node?: AudioNode | null) => {
  if (!node) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // A node can already be disconnected during rapid device switches.
  }
};

const toDb = (rms: number) => 20 * Math.log10(Math.max(rms, 0.000001));

const getParam = (pedal: Pedal, key: string) => pedal.params[key] ?? getParamDefault(pedal.type, key);

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
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private units = new Map<string, PedalUnit>();
  private masterVolume = 0.82;
  private inputBuffer: FloatAudioBuffer | null = null;
  private outputBuffer: FloatAudioBuffer | null = null;
  private tunerBuffer: FloatAudioBuffer | null = null;
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

    this.smoothParam(this.masterGain.gain, this.masterVolume, 0.015);
  }

  updatePedal(pedal: Pedal) {
    const unit = this.units.get(pedal.id);
    if (!unit || !this.context) {
      return;
    }

    this.applyPedalState(unit, pedal);
    this.applyPedalParams(unit, pedal);
  }

  rebuildChain(pedals: Pedal[], skipFade = false) {
    this.currentPedals = pedals.map((pedal) => ({ ...pedal, params: { ...pedal.params } }));

    if (!this.context || !this.source || !this.masterGain || !this.inputAnalyser || !this.outputAnalyser) {
      return;
    }

    if (this.pendingRebuild) {
      window.clearTimeout(this.pendingRebuild);
      this.pendingRebuild = 0;
    }

    const reconnect = () => {
      if (!this.context || !this.source || !this.masterGain || !this.inputAnalyser || !this.outputAnalyser) {
        return;
      }

      this.disconnectGraph();
      this.units.clear();

      this.masterGain.gain.setValueAtTime(0, this.context.currentTime);
      this.source.connect(this.inputAnalyser);

      let previous: AudioNode = this.inputAnalyser;
      pedals.forEach((pedal) => {
        const unit = this.createPedalUnit(pedal);
        previous.connect(unit.input);
        previous = unit.output;
        this.units.set(pedal.id, unit);
      });

      previous.connect(this.masterGain);
      this.masterGain.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.context.destination);
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
    return this.readMeter('input');
  }

  readOutputMeter(): MeterReading {
    return this.readMeter('output');
  }

  readTuner(): TunerReading {
    if (!this.inputAnalyser || !this.context) {
      return { note: '--', frequency: null, cents: 0, confidence: 0 };
    }

    if (!this.tunerBuffer || this.tunerBuffer.length !== this.inputAnalyser.fftSize) {
      this.tunerBuffer = new Float32Array(this.inputAnalyser.fftSize);
    }

    this.inputAnalyser.getFloatTimeDomainData(this.tunerBuffer);
    const result = this.detectPitch(this.tunerBuffer, this.context.sampleRate);
    if (!result.frequency) {
      return { note: '--', frequency: null, cents: 0, confidence: result.confidence };
    }

    const midi = Math.round(69 + 12 * Math.log2(result.frequency / 440));
    const normalizedIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const targetFrequency = 440 * 2 ** ((midi - 69) / 12);
    const cents = Math.round(1200 * Math.log2(result.frequency / targetFrequency));

    return {
      note: `${NOTE_NAMES[normalizedIndex]}${octave}`,
      frequency: result.frequency,
      cents,
      confidence: result.confidence,
    };
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
    await this.context.audioWorklet.addModule(WORKLET_URL);

    this.inputAnalyser = this.context.createAnalyser();
    this.inputAnalyser.fftSize = 4096;
    this.inputAnalyser.smoothingTimeConstant = 0.72;

    this.outputAnalyser = this.context.createAnalyser();
    this.outputAnalyser.fftSize = 2048;
    this.outputAnalyser.smoothingTimeConstant = 0.78;

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0;
  }

  private async replaceInputStream(deviceId?: string) {
    if (!this.context) {
      return;
    }

    this.stopStream();
    this.source = null;
    this.stream = await navigator.mediaDevices.getUserMedia(formatConstraintDevice(deviceId));
    this.source = this.context.createMediaStreamSource(this.stream);
  }

  private stopStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    safeDisconnect(this.source);
    this.source = null;
  }

  private disconnectGraph() {
    safeDisconnect(this.source);
    safeDisconnect(this.inputAnalyser);
    safeDisconnect(this.masterGain);
    safeDisconnect(this.outputAnalyser);
    this.units.forEach((unit) => {
      [
        unit.input,
        unit.output,
        unit.dryGain,
        unit.wetGain,
        unit.levelGain,
        ...unit.nodes,
      ].forEach(safeDisconnect);
    });
  }

  private createPedalUnit(pedal: Pedal): PedalUnit {
    if (!this.context) {
      throw new Error('Audio context is not ready.');
    }

    const input = this.context.createGain();
    const dryGain = this.context.createGain();
    const wetGain = this.context.createGain();
    const mixBus = this.context.createGain();
    const levelGain = this.context.createGain();
    const output = this.context.createGain();
    const core = this.createEffectCore(pedal);
    const unit: PedalUnit = {
      input,
      output,
      dryGain,
      wetGain,
      levelGain,
      controls: core.controls,
      nodes: [mixBus, ...core.nodes],
    };

    input.connect(dryGain);
    dryGain.connect(mixBus);
    input.connect(core.input);
    core.output.connect(wetGain);
    wetGain.connect(mixBus);
    mixBus.connect(levelGain);
    levelGain.connect(output);

    this.applyPedalState(unit, pedal, true);
    this.applyPedalParams(unit, pedal, true);
    return unit;
  }

  private createEffectCore(pedal: Pedal): {
    input: AudioNode;
    output: AudioNode;
    nodes: AudioNode[];
    controls: Map<string, ParamControl>;
  } {
    if (!this.context) {
      throw new Error('Audio context is not ready.');
    }

    const ctx = this.context;
    const controls = new Map<string, ParamControl>();

    if (pedal.type === 'noiseGate') {
      const gate = new AudioWorkletNode(ctx, 'noise-gate-processor', {
        parameterData: {
          threshold: getParam(pedal, 'threshold'),
          attack: getParam(pedal, 'attack'),
          release: getParam(pedal, 'release'),
        },
      });
      this.mapWorkletParams(gate, controls, ['threshold', 'attack', 'release']);
      return { input: gate, output: gate, nodes: [gate], controls };
    }

    if (pedal.type === 'compressor') {
      const compressor = ctx.createDynamicsCompressor();
      compressor.knee.value = 18;
      controls.set('threshold', { param: compressor.threshold });
      controls.set('ratio', { param: compressor.ratio });
      controls.set('attack', { param: compressor.attack, transform: (value) => value / 1000 });
      controls.set('release', { param: compressor.release, transform: (value) => value / 1000 });
      return { input: compressor, output: compressor, nodes: [compressor], controls };
    }

    if (pedal.type === 'drive') {
      const drive = new AudioWorkletNode(ctx, 'drive-processor', {
        parameterData: {
          drive: getParam(pedal, 'drive'),
          tone: getParam(pedal, 'tone'),
        },
      });
      this.mapWorkletParams(drive, controls, ['drive', 'tone']);
      return { input: drive, output: drive, nodes: [drive], controls };
    }

    if (pedal.type === 'ampEq') {
      const bass = ctx.createBiquadFilter();
      const mid = ctx.createBiquadFilter();
      const treble = ctx.createBiquadFilter();
      const presence = ctx.createBiquadFilter();

      bass.type = 'lowshelf';
      bass.frequency.value = 150;
      mid.type = 'peaking';
      mid.frequency.value = 760;
      mid.Q.value = 0.9;
      treble.type = 'highshelf';
      treble.frequency.value = 2600;
      presence.type = 'peaking';
      presence.frequency.value = 4200;
      presence.Q.value = 0.75;

      bass.connect(mid);
      mid.connect(treble);
      treble.connect(presence);

      controls.set('bass', { param: bass.gain });
      controls.set('mid', { param: mid.gain });
      controls.set('treble', { param: treble.gain });
      controls.set('presence', { param: presence.gain });
      return { input: bass, output: presence, nodes: [bass, mid, treble, presence], controls };
    }

    if (pedal.type === 'cabinet') {
      const body = ctx.createBiquadFilter();
      const convolver = ctx.createConvolver();
      const air = ctx.createBiquadFilter();
      const lowCut = ctx.createBiquadFilter();

      body.type = 'lowshelf';
      body.frequency.value = 180;
      lowCut.type = 'highpass';
      lowCut.frequency.value = 70;
      lowCut.Q.value = 0.5;
      air.type = 'lowpass';
      air.Q.value = 0.72;
      convolver.normalize = true;
      convolver.buffer = this.createCabinetImpulse();

      lowCut.connect(body);
      body.connect(convolver);
      convolver.connect(air);

      controls.set('body', { param: body.gain, transform: (value) => -5 + value * 11 });
      controls.set('air', { param: air.frequency, transform: (value) => 2600 + value * 6400 });
      return { input: lowCut, output: air, nodes: [lowCut, body, convolver, air], controls };
    }

    if (pedal.type === 'delay') {
      const delay = ctx.createDelay(1.2);
      const feedback = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      const output = ctx.createGain();

      tone.type = 'lowpass';
      tone.Q.value = 0.65;
      delay.connect(tone);
      tone.connect(output);
      tone.connect(feedback);
      feedback.connect(delay);

      controls.set('time', { param: delay.delayTime, transform: (value) => value / 1000, timeConstant: 0.025 });
      controls.set('feedback', { param: feedback.gain, transform: (value) => clamp(value, 0, 0.88) });
      controls.set('tone', { param: tone.frequency });
      return { input: delay, output, nodes: [delay, feedback, tone, output], controls };
    }

    if (pedal.type === 'reverb') {
      const reverb = new AudioWorkletNode(ctx, 'simple-reverb-processor', {
        parameterData: {
          size: getParam(pedal, 'size'),
          damping: getParam(pedal, 'damping'),
        },
      });
      this.mapWorkletParams(reverb, controls, ['size', 'damping']);
      return { input: reverb, output: reverb, nodes: [reverb], controls };
    }

    const fallback = ctx.createGain();
    return { input: fallback, output: fallback, nodes: [fallback], controls };
  }

  private applyPedalState(unit: PedalUnit, pedal: Pedal, immediate = false) {
    const active = pedal.enabled && !pedal.bypassed;
    const mix = active ? clamp(pedal.mix, 0, 1) : 0;
    const level = active ? clamp(pedal.level, 0, 1.5) : 1;

    this.setGain(unit.dryGain.gain, active ? 1 - mix : 1, immediate);
    this.setGain(unit.wetGain.gain, active ? mix : 0, immediate);
    this.setGain(unit.levelGain.gain, level, immediate);
  }

  private applyPedalParams(unit: PedalUnit, pedal: Pedal, immediate = false) {
    unit.controls.forEach((control, key) => {
      const rawValue = getParam(pedal, key);
      const value = control.transform ? control.transform(rawValue) : rawValue;
      if (immediate || !this.context) {
        control.param.value = value;
        return;
      }

      this.smoothParam(control.param, value, control.timeConstant ?? 0.02);
    });
  }

  private mapWorkletParams(node: AudioWorkletNode, controls: Map<string, ParamControl>, keys: string[]) {
    keys.forEach((key) => {
      const param = node.parameters.get(key);
      if (param) {
        controls.set(key, { param });
      }
    });
  }

  private setGain(param: AudioParam, value: number, immediate = false) {
    if (!this.context || immediate) {
      param.value = value;
      return;
    }

    this.smoothParam(param, value, 0.012);
  }

  private smoothParam(param: AudioParam, value: number, timeConstant: number) {
    if (!this.context) {
      param.value = value;
      return;
    }

    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, timeConstant);
  }

  private fadeMaster(value: number, seconds: number) {
    if (!this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;
    const current = this.masterGain.gain.value;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(current, now);
    this.masterGain.gain.linearRampToValueAtTime(value, now + seconds);
  }

  private readMeter(kind: 'input' | 'output'): MeterReading {
    const analyser = kind === 'input' ? this.inputAnalyser : this.outputAnalyser;
    if (!analyser) {
      return { rms: 0, peak: 0, db: -120 };
    }

    const bufferKey = kind === 'input' ? 'inputBuffer' : 'outputBuffer';
    if (!this[bufferKey] || this[bufferKey]?.length !== analyser.fftSize) {
      this[bufferKey] = new Float32Array(analyser.fftSize);
    }

    const buffer = this[bufferKey] as FloatAudioBuffer;
    analyser.getFloatTimeDomainData(buffer);

    let sum = 0;
    let peak = 0;
    for (let index = 0; index < buffer.length; index += 1) {
      const sample = buffer[index];
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }

    const rms = Math.sqrt(sum / buffer.length);
    return { rms, peak, db: toDb(rms) };
  }

  private detectPitch(buffer: FloatAudioBuffer, sampleRate: number) {
    let sum = 0;
    for (let index = 0; index < buffer.length; index += 1) {
      sum += buffer[index] * buffer[index];
    }

    const rms = Math.sqrt(sum / buffer.length);
    if (rms < 0.006) {
      return { frequency: null, confidence: 0 };
    }

    const minLag = Math.floor(sampleRate / 1000);
    const maxLag = Math.min(Math.floor(sampleRate / 55), Math.floor(buffer.length / 2));
    let bestLag = -1;
    let bestCorrelation = 0;
    const correlations = new Float32Array(maxLag + 1);

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let correlation = 0;
      let normA = 0;
      let normB = 0;

      for (let index = 0; index < buffer.length - lag; index += 1) {
        const a = buffer[index];
        const b = buffer[index + lag];
        correlation += a * b;
        normA += a * a;
        normB += b * b;
      }

      correlation = correlation / Math.sqrt(normA * normB || 1);
      correlations[lag] = correlation;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }

    if (bestLag < 0 || bestCorrelation < 0.55) {
      return { frequency: null, confidence: bestCorrelation };
    }

    const previous = correlations[bestLag - 1] ?? bestCorrelation;
    const next = correlations[bestLag + 1] ?? bestCorrelation;
    const correction = (next - previous) / (2 * (2 * bestCorrelation - previous - next) || 1);
    const refinedLag = bestLag + clamp(correction, -0.5, 0.5);

    return {
      frequency: sampleRate / refinedLag,
      confidence: bestCorrelation,
    };
  }

  private createCabinetImpulse() {
    if (!this.context) {
      throw new Error('Audio context is not ready.');
    }

    const sampleRate = this.context.sampleRate;
    const length = Math.floor(sampleRate * 0.075);
    const buffer = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      data[0] = 1;

      for (let index = 1; index < length; index += 1) {
        const time = index / sampleRate;
        const seed = ((index * 16807 + channel * 48271) % 2147483647) / 2147483647;
        const noise = seed * 2 - 1;
        const cone = Math.sin(2 * Math.PI * 112 * time) * Math.exp(-time * 44);
        const paper = Math.sin(2 * Math.PI * 390 * time + channel * 0.2) * Math.exp(-time * 80);
        data[index] = (cone * 0.34 + paper * 0.12 + noise * 0.055) * Math.exp(-time * 32);
      }
    }

    return buffer;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
