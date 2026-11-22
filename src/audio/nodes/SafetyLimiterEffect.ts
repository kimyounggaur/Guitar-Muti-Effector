import { AudioEngineError } from '../errors';
import processorUrl from '../worklets/safety-limiter-processor.ts?worker&url';

const loadedContexts = new WeakMap<AudioContext, Promise<void>>();

export function prepareSafetyLimiter(context: AudioContext): Promise<void> {
  let promise = loadedContexts.get(context);
  if (!promise) {
    if (!context.audioWorklet) return Promise.reject(new AudioEngineError('unsupportedBrowser'));
    promise = context.audioWorklet.addModule(processorUrl);
    loadedContexts.set(context, promise);
  }
  return promise;
}

export function createSafetyLimiter(context: AudioContext): AudioWorkletNode {
  return new AudioWorkletNode(context, 'safety-limiter-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
}
