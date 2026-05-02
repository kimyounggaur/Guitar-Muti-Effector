import { EffectNodeWrapper, PedalParamValue, PedalType } from '../types';
import looperProcessorUrl from '../worklets/looper-processor.ts?worker&url';

export type LooperState = 'idle' | 'recording' | 'playing' | 'overdubbing' | 'stopped' | 'loading' | 'error';

export type LooperReading = {
  state: LooperState;
  position: number;
  length: number;
  durationSec: number;
  progress: number;
  hasLoop: boolean;
  canUndo: boolean;
  reverse: boolean;
  halfSpeed: boolean;
};

type LooperListener = (reading: LooperReading) => void;

const listenersById = new Map<string, Set<LooperListener>>();
const workletReadyByContext = new WeakMap<AudioContext, Promise<void>>();

export const emptyLooperReading: LooperReading = {
  state: 'loading',
  position: 0,
  length: 0,
  durationSec: 0,
  progress: 0,
  hasLoop: false,
  canUndo: false,
  reverse: false,
  halfSpeed: false,
};

export const subscribeLooper = (id: string, listener: LooperListener) => {
  const listeners = listenersById.get(id) ?? new Set<LooperListener>();
  listeners.add(listener);
  listenersById.set(id, listeners);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      listenersById.delete(id);
    }
  };
};

export class LooperNode implements EffectNodeWrapper {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly type: PedalType = 'looper';
  private readonly dryGain: GainNode;
  private readonly loopGain: GainNode;
  private workletNode: AudioWorkletNode | null = null;
  private bypassed = false;
  private disposed = false;
  private pendingParams = new Map<string, PedalParamValue>();

  constructor(private readonly context: AudioContext, readonly id: string) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.dryGain = context.createGain();
    this.loopGain = context.createGain();
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);
    this.loopGain.connect(this.output);
    this.loopGain.gain.value = 0.85;
    void this.initialize();
  }

  connect(destination: AudioNode) {
    this.output.connect(destination);
  }

  disconnect() {
    safeDisconnect(this.output);
  }

  setParam(name: string, value: PedalParamValue) {
    if (name === '__looperCommand') {
      this.postCommand(String(value));
      return;
    }

    if (name === 'level') {
      smoothParam(this.context, this.loopGain.gain, percentToUnit(value, 85), 0.015);
    }

    this.pendingParams.set(name, value);
    this.postParam(name, value);
  }

  setBypass(bypassed: boolean) {
    this.bypassed = bypassed;
    smoothParam(this.context, this.loopGain.gain, bypassed ? 0 : percentToUnit(this.pendingParams.get('level'), 85), 0.01);
    smoothParam(this.context, this.dryGain.gain, 1, 0.01);
  }

  dispose() {
    this.disposed = true;
    this.postCommand('stop');
    safeDisconnect(this.input);
    safeDisconnect(this.output);
    safeDisconnect(this.dryGain);
    safeDisconnect(this.loopGain);
    safeDisconnect(this.workletNode);
    listenersById.delete(this.id);
  }

  private async initialize() {
    try {
      await ensureLooperWorklet(this.context);

      if (this.disposed) {
        return;
      }

      this.workletNode = new AudioWorkletNode(this.context, 'looper-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.workletNode.port.onmessage = (event) => this.handleWorkletMessage(event.data);
      this.input.connect(this.workletNode);
      this.workletNode.connect(this.loopGain);
      this.pendingParams.forEach((value, name) => this.postParam(name, value));
      this.publish({ ...emptyLooperReading, state: 'idle' });
    } catch {
      this.publish({ ...emptyLooperReading, state: 'error' });
    }
  }

  private handleWorkletMessage(data: unknown) {
    if (!data || typeof data !== 'object') {
      return;
    }

    const message = data as Partial<LooperReading> & { type?: string };
    if (message.type !== 'state') {
      return;
    }

    this.publish({
      state: readState(message.state),
      position: readNumber(message.position, 0),
      length: readNumber(message.length, 0),
      durationSec: readNumber(message.durationSec, 0),
      progress: readNumber(message.progress, 0),
      hasLoop: message.hasLoop === true,
      canUndo: message.canUndo === true,
      reverse: message.reverse === true,
      halfSpeed: message.halfSpeed === true,
    });
  }

  private postParam(name: string, value: PedalParamValue) {
    this.workletNode?.port.postMessage({ type: 'param', name, value });
  }

  private postCommand(command: string) {
    this.workletNode?.port.postMessage({ type: 'command', command });
  }

  private publish(reading: LooperReading) {
    const listeners = listenersById.get(this.id);
    listeners?.forEach((listener) => listener(reading));
  }
}

const ensureLooperWorklet = (context: AudioContext) => {
  const existing = workletReadyByContext.get(context);
  if (existing) {
    return existing;
  }

  const ready = context.audioWorklet.addModule(looperProcessorUrl);
  workletReadyByContext.set(context, ready);
  return ready;
};

const percentToUnit = (value: PedalParamValue | undefined, fallback: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(1, Math.max(0, numberValue / 100));
};

const readNumber = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

const readState = (value: unknown): LooperState => {
  if (
    value === 'idle' ||
    value === 'recording' ||
    value === 'playing' ||
    value === 'overdubbing' ||
    value === 'stopped'
  ) {
    return value;
  }

  return 'idle';
};

const smoothParam = (context: AudioContext, param: AudioParam, value: number, seconds = 0.015) => {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, seconds);
};

const safeDisconnect = (node: AudioNode | null) => {
  if (!node) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // Nodes may already be disconnected while the graph is rebuilt.
  }
};
