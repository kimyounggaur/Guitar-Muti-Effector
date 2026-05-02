import { EffectNodeWrapper, PedalParamValue, PedalType } from '../types';

type ParamHandler = (value: PedalParamValue) => void;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asNumber = (value: PedalParamValue, fallback = 0) => (typeof value === 'number' ? value : fallback);

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.015) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

const safeDisconnect = (node: AudioNode) => {
  try {
    node.disconnect();
  } catch {
    // Nodes may already be disconnected while the graph is being rebuilt.
  }
};

export class BaseEffect implements EffectNodeWrapper {
  readonly input: GainNode;
  readonly output: GainNode;
  protected readonly wetInput: GainNode;
  protected readonly wetOutput: GainNode;
  protected readonly dryGain: GainNode;
  protected readonly wetGain: GainNode;
  protected readonly nodes: AudioNode[] = [];
  protected readonly paramHandlers = new Map<string, ParamHandler>();
  private bypassed = false;
  private mix = 1;

  constructor(
    protected readonly context: AudioContext,
    readonly id: string,
    readonly type: PedalType,
  ) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.wetInput = context.createGain();
    this.wetOutput = context.createGain();
    this.dryGain = context.createGain();
    this.wetGain = context.createGain();

    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.input.connect(this.wetInput);
    this.wetOutput.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.setBypass(false);
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    safeDisconnect(this.output);
  }

  setParam(name: string, value: PedalParamValue) {
    const handler = this.paramHandlers.get(name);
    if (handler) {
      handler(value);
    }
  }

  setBypass(bypassed: boolean) {
    this.bypassed = bypassed;
    const wet = bypassed ? 0 : this.mix;
    const dry = bypassed ? 1 : 1 - this.mix;
    smoothParam(this.context, this.wetGain.gain, wet, 0.01);
    smoothParam(this.context, this.dryGain.gain, dry, 0.01);
  }

  dispose() {
    [this.input, this.output, this.wetInput, this.wetOutput, this.dryGain, this.wetGain, ...this.nodes].forEach(
      safeDisconnect,
    );
  }

  protected setMix(value: number) {
    this.mix = clamp(value, 0, 1);
    this.setBypass(this.bypassed);
  }

  protected connectWet(...nodes: AudioNode[]) {
    if (nodes.length === 0) {
      this.wetInput.connect(this.wetOutput);
      return;
    }

    this.wetInput.connect(nodes[0]);
    nodes.forEach((node, index) => {
      const next = nodes[index + 1];
      if (next) {
        node.connect(next);
      }
    });
    nodes[nodes.length - 1].connect(this.wetOutput);
    this.nodes.push(...nodes);
  }
}

export class PassthroughEffect extends BaseEffect {
  constructor(context: AudioContext, id: string, type: PedalType) {
    super(context, id, type);
    this.connectWet();
    this.setMix(1);
  }
}

export class CompressorEffect extends BaseEffect {
  private readonly compressor: DynamicsCompressorNode;
  private readonly makeupGain: GainNode;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'compressor');
    this.compressor = context.createDynamicsCompressor();
    this.makeupGain = context.createGain();
    this.compressor.knee.value = 18;
    this.compressor.attack.value = 0.012;
    this.compressor.release.value = 0.18;
    this.connectWet(this.compressor, this.makeupGain);
    this.setMix(1);

    this.paramHandlers.set('thresholdDb', (value) =>
      smoothParam(context, this.compressor.threshold, asNumber(value, -24)),
    );
    this.paramHandlers.set('ratio', (value) => smoothParam(context, this.compressor.ratio, asNumber(value, 4)));
    this.paramHandlers.set('makeupGainDb', (value) =>
      smoothParam(context, this.makeupGain.gain, dbToGain(asNumber(value, 0))),
    );
  }
}

export class AmpEQEffect extends BaseEffect {
  constructor(context: AudioContext, id: string) {
    super(context, id, 'ampEQ');
    const bass = context.createBiquadFilter();
    const mid = context.createBiquadFilter();
    const treble = context.createBiquadFilter();
    const presence = context.createBiquadFilter();

    bass.type = 'lowshelf';
    bass.frequency.value = 140;
    mid.type = 'peaking';
    mid.frequency.value = 760;
    mid.Q.value = 0.9;
    treble.type = 'highshelf';
    treble.frequency.value = 2600;
    presence.type = 'peaking';
    presence.frequency.value = 4200;
    presence.Q.value = 0.7;

    this.connectWet(bass, mid, treble, presence);
    this.setMix(1);

    this.paramHandlers.set('bassDb', (value) => smoothParam(context, bass.gain, asNumber(value, 0)));
    this.paramHandlers.set('midDb', (value) => smoothParam(context, mid.gain, asNumber(value, 0)));
    this.paramHandlers.set('trebleDb', (value) => smoothParam(context, treble.gain, asNumber(value, 0)));
    this.paramHandlers.set('presenceDb', (value) => smoothParam(context, presence.gain, asNumber(value, 0)));
  }
}

export class CabinetIREffect extends BaseEffect {
  constructor(context: AudioContext, id: string) {
    super(context, id, 'cabinetIR');
    const highpass = context.createBiquadFilter();
    const body = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 70;
    body.type = 'peaking';
    body.frequency.value = 240;
    body.gain.value = 3;
    body.Q.value = 0.8;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 5200;
    lowpass.Q.value = 0.7;
    this.connectWet(highpass, body, lowpass);
    this.setMix(1);
    this.paramHandlers.set('mix', (value) => this.setMix(asNumber(value, 1)));
  }
}

export class DelayEffect extends BaseEffect {
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;

  constructor(context: AudioContext, id: string) {
    super(context, id, 'delay');
    this.delay = context.createDelay(1.2);
    this.feedback = context.createGain();
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 4200;
    this.delay.delayTime.value = 0.32;
    this.feedback.gain.value = 0.28;
    this.delay.connect(tone);
    tone.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.wetInput.connect(this.delay);
    tone.connect(this.wetOutput);
    this.nodes.push(this.delay, this.feedback, tone);
    this.setMix(0.22);

    this.paramHandlers.set('timeMs', (value) =>
      smoothParam(context, this.delay.delayTime, clamp(asNumber(value, 320), 20, 1200) / 1000, 0.025),
    );
    this.paramHandlers.set('feedback', (value) =>
      smoothParam(context, this.feedback.gain, clamp(asNumber(value, 0.28), 0, 0.88)),
    );
    this.paramHandlers.set('mix', (value) => this.setMix(asNumber(value, 0.22)));
  }
}

export class ReverbEffect extends BaseEffect {
  constructor(context: AudioContext, id: string) {
    super(context, id, 'reverb');
    const convolver = context.createConvolver();
    const damping = context.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.value = 4800;
    convolver.buffer = createReverbImpulse(context);
    this.connectWet(convolver, damping);
    this.setMix(0.18);
    this.paramHandlers.set('mix', (value) => this.setMix(asNumber(value, 0.18)));
    this.paramHandlers.set('damping', (value) =>
      smoothParam(context, damping.frequency, 9000 - clamp(asNumber(value, 0.4), 0, 1) * 7200),
    );
  }
}

export class ModulationEffect extends BaseEffect {
  constructor(context: AudioContext, id: string) {
    super(context, id, 'modulation');
    const delay = context.createDelay(0.04);
    const depth = context.createGain();
    const lfo = context.createOscillator();
    delay.delayTime.value = 0.012;
    depth.gain.value = 0.004;
    lfo.frequency.value = 0.7;
    lfo.connect(depth);
    depth.connect(delay.delayTime);
    lfo.start();
    this.connectWet(delay);
    this.nodes.push(depth, lfo);
    this.setMix(0.5);
  }
}

const dbToGain = (db: number) => 10 ** (db / 20);

const createReverbImpulse = (context: AudioContext) => {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * 1.2);
  const buffer = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const seed = ((index * 16807 + channel * 48271) % 2147483647) / 2147483647;
      data[index] = (seed * 2 - 1) * (1 - index / length) ** 2.3;
    }
  }

  return buffer;
};
