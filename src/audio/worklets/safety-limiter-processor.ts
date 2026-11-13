export {};
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, ctor: typeof AudioWorkletProcessor): void;

/** Linked peak limiter. The current sample controls its own gain: no lookahead. */
class SafetyLimiterProcessor extends AudioWorkletProcessor {
  private gain = 1;
  private readonly releaseCoefficient = Math.exp(-1 / (sampleRate * 0.08));

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0] ?? [];
    const output = outputs[0] ?? [];
    const frames = output[0]?.length ?? 0;
    for (let i = 0; i < frames; i++) {
      let peak = 0;
      for (const channel of input) {
        const sample = channel[i];
        if (Number.isFinite(sample)) peak = Math.max(peak, Math.abs(sample));
      }
      const target = peak > 0.8 ? 0.8 / peak : 1;
      const recovered = 1 - (1 - this.gain) * this.releaseCoefficient;
      // Attack is immediate; recovery cannot exceed unity or the current safe gain.
      this.gain = Math.min(target, recovered, 1);
      for (let channel = 0; channel < output.length; channel++) {
        const sample = input[channel]?.[i] ?? input[0]?.[i] ?? 0;
        const safe = Number.isFinite(sample) ? sample * this.gain : 0;
        output[channel][i] = Math.max(-0.8, Math.min(0.8, safe));
      }
    }
    return true;
  }
}
registerProcessor('safety-limiter-processor', SafetyLimiterProcessor);
