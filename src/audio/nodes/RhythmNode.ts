import { EffectNodeWrapper, PedalParamValue } from '../types';

export type RhythmPatternId =
  | 'metronome'
  | 'rock1'
  | 'rock2'
  | 'bluesShuffle'
  | 'funk'
  | 'ballad'
  | 'sixEight'
  | 'pop';

export type RhythmReading = {
  isPlaying: boolean;
  bpm: number;
  pattern: RhythmPatternId;
  currentStep: number;
  stepCount: number;
  beatIndex: number;
  beatCount: number;
  lastBeatAt: number;
};

type DrumVoice = 'kick' | 'snare' | 'hihat' | 'click' | 'accent';

type PatternStep = Partial<Record<DrumVoice, number>>;

type RhythmPattern = {
  id: RhythmPatternId;
  name: string;
  stepsPerBeat: number;
  beatCount: number;
  steps: PatternStep[];
};

type RhythmListener = (reading: RhythmReading) => void;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asNumber = (value: PedalParamValue, fallback: number) => (typeof value === 'number' ? value : fallback);

const safeDisconnect = (node: AudioNode) => {
  try {
    node.disconnect();
  } catch {
    // Nodes can already be disconnected during graph rebuilds.
  }
};

const rhythmSubscriptions = new Map<string, Set<RhythmListener>>();

export const emptyRhythmReading: RhythmReading = {
  isPlaying: false,
  bpm: 120,
  pattern: 'metronome',
  currentStep: 0,
  stepCount: 16,
  beatIndex: 0,
  beatCount: 4,
  lastBeatAt: 0,
};

export const subscribeRhythm = (id: string, listener: RhythmListener) => {
  const listeners = rhythmSubscriptions.get(id) ?? new Set<RhythmListener>();
  listeners.add(listener);
  rhythmSubscriptions.set(id, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      rhythmSubscriptions.delete(id);
    }
  };
};

export class RhythmNode implements EffectNodeWrapper {
  readonly type = 'rhythm';
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly passGain: GainNode;
  private readonly drumGain: GainNode;
  private bpm = 120;
  private volume = 70;
  private patternId: RhythmPatternId = 'metronome';
  private isPlaying = false;
  private bypassed = false;
  private currentStep = 0;
  private nextStepTime = 0;
  private schedulerTimer = 0;
  private readonly lookaheadMs = 25;
  private readonly scheduleAheadSec = 0.12;

  constructor(private readonly context: AudioContext, readonly id: string) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.passGain = context.createGain();
    this.drumGain = context.createGain();

    this.input.connect(this.passGain);
    this.passGain.connect(this.output);
    this.drumGain.connect(this.output);
    this.applyVolume(false);
    this.publish();
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    safeDisconnect(this.output);
  }

  setParam(name: string, value: PedalParamValue) {
    if (name === 'bpm') {
      this.bpm = clamp(Math.round(asNumber(value, 120)), 40, 240);
      this.publish();
      return;
    }

    if (name === 'pattern') {
      this.patternId = readPatternId(value);
      this.currentStep = this.currentStep % getPattern(this.patternId).steps.length;
      this.publish();
      return;
    }

    if (name === 'volume') {
      this.volume = clamp(asNumber(value, 70), 0, 100);
      this.applyVolume(true);
      return;
    }

    if (name === 'playing') {
      if (value === true) {
        this.start();
      } else {
        this.stop();
      }
      return;
    }

    if (name === '__rhythmCommand') {
      if (value === 'tap-start') {
        this.start();
      } else if (value === 'stop') {
        this.stop();
      }
    }
  }

  setBypass(bypassed: boolean) {
    this.bypassed = bypassed;
    const now = this.context.currentTime;
    this.drumGain.gain.cancelScheduledValues(now);
    this.drumGain.gain.setTargetAtTime(bypassed ? 0 : volumeToGain(this.volume), now, 0.012);
  }

  dispose() {
    this.stop();
    [this.input, this.output, this.passGain, this.drumGain].forEach(safeDisconnect);
  }

  private start() {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.context.currentTime + 0.045;
    this.schedulerTimer = window.setInterval(() => this.schedulerTick(), this.lookaheadMs);
    this.publish();
  }

  private stop() {
    if (this.schedulerTimer) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = 0;
    }

    this.isPlaying = false;
    this.currentStep = 0;
    this.publish();
  }

  private schedulerTick() {
    while (this.nextStepTime < this.context.currentTime + this.scheduleAheadSec) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private scheduleStep(stepIndex: number, time: number) {
    const pattern = getPattern(this.patternId);
    const step = pattern.steps[stepIndex] ?? {};

    Object.entries(step).forEach(([voice, velocity]) => {
      if (velocity > 0) {
        this.scheduleVoice(voice as DrumVoice, time, velocity);
      }
    });

    if (stepIndex % pattern.stepsPerBeat === 0) {
      window.setTimeout(() => this.publish(stepIndex), Math.max(0, (time - this.context.currentTime) * 1000));
    }
  }

  private advanceStep() {
    const pattern = getPattern(this.patternId);
    this.currentStep = (this.currentStep + 1) % pattern.steps.length;
    this.nextStepTime += this.getStepSeconds(pattern);
  }

  private getStepSeconds(pattern: RhythmPattern) {
    return 60 / this.bpm / pattern.stepsPerBeat;
  }

  private scheduleVoice(voice: DrumVoice, time: number, velocity: number) {
    if (voice === 'kick') {
      this.scheduleKick(time, velocity);
      return;
    }

    if (voice === 'snare') {
      this.scheduleSnare(time, velocity);
      return;
    }

    if (voice === 'hihat') {
      this.scheduleHat(time, velocity);
      return;
    }

    this.scheduleClick(time, velocity, voice === 'accent');
  }

  private scheduleKick(time: number, velocity: number) {
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(132, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.11);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.95 * velocity, time + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(amp);
    amp.connect(this.drumGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private scheduleSnare(time: number, velocity: number) {
    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const amp = this.context.createGain();
    noise.buffer = createNoiseBuffer(this.context, 0.16);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(0.75, time);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.62 * velocity, time + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    noise.connect(filter);
    filter.connect(amp);
    amp.connect(this.drumGain);
    noise.start(time);
    noise.stop(time + 0.17);
  }

  private scheduleHat(time: number, velocity: number) {
    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const amp = this.context.createGain();
    noise.buffer = createNoiseBuffer(this.context, 0.045);
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, time);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.28 * velocity, time + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    noise.connect(filter);
    filter.connect(amp);
    amp.connect(this.drumGain);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  private scheduleClick(time: number, velocity: number, accented: boolean) {
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accented ? 1760 : 1180, time);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime((accented ? 0.36 : 0.24) * velocity, time + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
    osc.connect(amp);
    amp.connect(this.drumGain);
    osc.start(time);
    osc.stop(time + 0.065);
  }

  private applyVolume(smooth: boolean) {
    const now = this.context.currentTime;
    const nextGain = this.bypassed ? 0 : volumeToGain(this.volume);
    this.drumGain.gain.cancelScheduledValues(now);
    if (smooth) {
      this.drumGain.gain.setTargetAtTime(nextGain, now, 0.015);
    } else {
      this.drumGain.gain.setValueAtTime(nextGain, now);
    }
  }

  private publish(stepOverride = this.currentStep) {
    const pattern = getPattern(this.patternId);
    const reading: RhythmReading = {
      isPlaying: this.isPlaying,
      bpm: this.bpm,
      pattern: this.patternId,
      currentStep: stepOverride,
      stepCount: pattern.steps.length,
      beatIndex: Math.floor(stepOverride / pattern.stepsPerBeat) % pattern.beatCount,
      beatCount: pattern.beatCount,
      lastBeatAt: performance.now(),
    };

    rhythmSubscriptions.get(this.id)?.forEach((listener) => listener(reading));
  }
}

export const getRhythmPatternName = (id: RhythmPatternId) => getPattern(id).name;

const volumeToGain = (volume: number) => {
  const unit = clamp(volume, 0, 100) / 100;
  return unit * unit * 0.9;
};

const createNoiseBuffer = (context: AudioContext, seconds: number) => {
  const length = Math.max(1, Math.round(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }
  return buffer;
};

const readPatternId = (value: PedalParamValue): RhythmPatternId => {
  if (
    value === 'metronome' ||
    value === 'rock1' ||
    value === 'rock2' ||
    value === 'bluesShuffle' ||
    value === 'funk' ||
    value === 'ballad' ||
    value === 'sixEight' ||
    value === 'pop'
  ) {
    return value;
  }

  return 'metronome';
};

const makeFourFour = (id: RhythmPatternId, name: string, steps: PatternStep[]): RhythmPattern => ({
  id,
  name,
  stepsPerBeat: 4,
  beatCount: 4,
  steps,
});

const patterns: Record<RhythmPatternId, RhythmPattern> = {
  metronome: makeFourFour('metronome', 'Metronome 4/4', [
    { accent: 1 },
    {},
    {},
    {},
    { click: 0.72 },
    {},
    {},
    {},
    { click: 0.72 },
    {},
    {},
    {},
    { click: 0.72 },
    {},
    {},
    {},
  ]),
  rock1: makeFourFour('rock1', 'Rock 1', [
    { kick: 1, hihat: 0.62 },
    {},
    { hihat: 0.42 },
    {},
    { snare: 0.92, hihat: 0.62 },
    {},
    { hihat: 0.42 },
    {},
    { kick: 0.88, hihat: 0.62 },
    {},
    { hihat: 0.42 },
    { kick: 0.62 },
    { snare: 0.92, hihat: 0.62 },
    {},
    { hihat: 0.42 },
    {},
  ]),
  rock2: makeFourFour('rock2', 'Rock 2', [
    { kick: 1, hihat: 0.62 },
    {},
    { hihat: 0.38 },
    { kick: 0.55 },
    { snare: 0.9, hihat: 0.62 },
    {},
    { hihat: 0.38 },
    {},
    { kick: 0.86, hihat: 0.62 },
    { kick: 0.46 },
    { hihat: 0.38 },
    {},
    { snare: 0.94, hihat: 0.62 },
    {},
    { hihat: 0.38 },
    { kick: 0.48 },
  ]),
  bluesShuffle: {
    id: 'bluesShuffle',
    name: 'Blues Shuffle',
    stepsPerBeat: 3,
    beatCount: 4,
    steps: [
      { kick: 0.9, hihat: 0.6 },
      {},
      { hihat: 0.42 },
      { snare: 0.78, hihat: 0.58 },
      {},
      { hihat: 0.42 },
      { kick: 0.74, hihat: 0.58 },
      {},
      { hihat: 0.42 },
      { snare: 0.82, hihat: 0.58 },
      {},
      { hihat: 0.42 },
    ],
  },
  funk: makeFourFour('funk', 'Funk', [
    { kick: 0.96, hihat: 0.55 },
    { hihat: 0.24 },
    { snare: 0.38, hihat: 0.46 },
    {},
    { snare: 0.88, hihat: 0.56 },
    { kick: 0.42 },
    { hihat: 0.42 },
    { kick: 0.5 },
    { hihat: 0.55 },
    { snare: 0.32 },
    { kick: 0.62, hihat: 0.44 },
    {},
    { snare: 0.9, hihat: 0.56 },
    {},
    { hihat: 0.46 },
    { kick: 0.48 },
  ]),
  ballad: makeFourFour('ballad', 'Ballad', [
    { kick: 0.82, hihat: 0.34 },
    {},
    { hihat: 0.28 },
    {},
    { snare: 0.68, hihat: 0.34 },
    {},
    { hihat: 0.28 },
    {},
    { kick: 0.62, hihat: 0.34 },
    {},
    { hihat: 0.28 },
    {},
    { snare: 0.68, hihat: 0.34 },
    {},
    { hihat: 0.28 },
    {},
  ]),
  sixEight: {
    id: 'sixEight',
    name: '6/8',
    stepsPerBeat: 3,
    beatCount: 2,
    steps: [
      { kick: 0.92, hihat: 0.5 },
      { hihat: 0.26 },
      { hihat: 0.32 },
      { snare: 0.74, hihat: 0.5 },
      { hihat: 0.26 },
      { hihat: 0.32 },
    ],
  },
  pop: makeFourFour('pop', 'Pop', [
    { kick: 0.92, hihat: 0.54 },
    {},
    { hihat: 0.4 },
    {},
    { snare: 0.82, hihat: 0.54 },
    {},
    { kick: 0.46, hihat: 0.4 },
    {},
    { kick: 0.8, hihat: 0.54 },
    {},
    { hihat: 0.4 },
    {},
    { snare: 0.84, hihat: 0.54 },
    {},
    { kick: 0.52, hihat: 0.4 },
    {},
  ]),
};

const getPattern = (id: RhythmPatternId) => patterns[id] ?? patterns.metronome;
