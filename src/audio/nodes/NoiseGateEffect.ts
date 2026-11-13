import { BaseEffect } from './BaseEffect';
import processorUrl from '../worklets/noise-gate-processor.ts?worker&url';

const loadedContexts = new WeakMap<AudioContext, Promise<void>>();

export function prepareNoiseGate(context: AudioContext): Promise<void> {
  let promise = loadedContexts.get(context);
  if (!promise) {
    if (!context.audioWorklet) return Promise.reject(new Error('이 브라우저는 노이즈 게이트를 지원하지 않습니다. HTTPS의 최신 브라우저를 사용해 주세요.'));
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
    for (const name of ['thresholdDb', 'attackMs', 'holdMs', 'releaseMs']) {
      this.paramHandlers.set(name, (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) gate.port.postMessage({ name, value });
      });
    }
  }
}
