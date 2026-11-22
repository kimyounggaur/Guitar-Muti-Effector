import { AudioEngineError } from '../errors';
import { BaseEffect } from './BaseEffect';
import processorUrl from '../worklets/noise-gate-processor.ts?worker&url';
import { PEDAL_SCHEMAS, clampNumberParam } from '../params/schema';

const S = PEDAL_SCHEMAS.noiseGate;

const loadedContexts = new WeakMap<AudioContext, Promise<void>>();

export function prepareNoiseGate(context: AudioContext): Promise<void> {
  let promise = loadedContexts.get(context);
  if (!promise) {
    if (!context.audioWorklet) return Promise.reject(new AudioEngineError('unsupportedBrowser'));
    promise = context.audioWorklet.addModule(processorUrl);
    loadedContexts.set(context, promise);
  }
  return promise;
}

export class NoiseGateEffect extends BaseEffect {
  constructor(context: AudioContext, id: string) {
    super(context, id, 'noiseGate');
    const gate = new AudioWorkletNode(context, 'noise-gate-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.connectWet(gate);
    for (const name of ['thresholdDb', 'attackMs', 'holdMs', 'releaseMs'] as const) {
      this.paramHandlers.set(name, (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) gate.port.postMessage({ name, value: clampNumberParam(S[name], value) });
      });
    }
  }
}
