import processorUrl from '../worklets/safety-limiter-processor.ts?worker&url';

const loadedContexts = new WeakMap<AudioContext, Promise<void>>();

export function prepareSafetyLimiter(context: AudioContext): Promise<void> {
  let promise = loadedContexts.get(context);
  if (!promise) {
    if (!context.audioWorklet) return Promise.reject(new Error('이 브라우저는 안전 리미터를 지원하지 않습니다. HTTPS의 최신 브라우저를 사용해 주세요.'));
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
