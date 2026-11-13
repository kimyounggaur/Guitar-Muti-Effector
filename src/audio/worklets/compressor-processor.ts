export {};
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, ctor: typeof AudioWorkletProcessor): void;

/** Linked-channel feed-forward compressor with no sample delay or lookahead. */
class CompressorProcessor extends AudioWorkletProcessor {
  private threshold = -38.08;
  private ratio = 7.91;
  private knee = 18;
  private attack = 0.012;
  private release = 0.22;
  private reduction = 0;
  private reportFrames = 0;
  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent) => {
      if (!data || typeof data.value !== 'number' || !Number.isFinite(data.value)) return;
      const v = data.value;
      switch (data.name) {
        case 'threshold': this.threshold = Math.max(-100, Math.min(0, v)); break;
        case 'ratio': this.ratio = Math.max(1, Math.min(20, v)); break;
        case 'knee': this.knee = Math.max(0, Math.min(40, v)); break;
        case 'attack': this.attack = Math.max(0.001, Math.min(0.1, v)); break;
        case 'release': this.release = Math.max(0.05, Math.min(1, v)); break;
      }
    };
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0] ?? [];
    const output = outputs[0] ?? [];
    const frames = output[0]?.length ?? 0;
    const attack = Math.exp(-1 / (sampleRate * this.attack));
    const release = Math.exp(-1 / (sampleRate * this.release));
    const slope = 1 - 1 / this.ratio;
    for (let i = 0; i < frames; i++) {
      let peak = 0;
      for (const channel of input) {
        const sample = channel[i];
        if (Number.isFinite(sample)) peak = Math.max(peak, Math.abs(sample));
      }
      const db = 20 * Math.log10(Math.max(peak, 1e-12));
      const over = db - this.threshold;
      let target = 0;
      if (this.knee > 0 && over > -this.knee / 2 && over < this.knee / 2) {
        target = slope * (over + this.knee / 2) ** 2 / (2 * this.knee);
      } else if (over >= this.knee / 2) target = slope * over;
      const coefficient = target > this.reduction ? attack : release;
      this.reduction = coefficient * this.reduction + (1 - coefficient) * target;
      const gain = Math.pow(10, -this.reduction / 20);
      for (let channel = 0; channel < output.length; channel++) {
        const sample = input[channel]?.[i] ?? input[0]?.[i] ?? 0;
        output[channel][i] = Number.isFinite(sample) ? sample * gain : 0;
      }
    }
    this.reportFrames += frames;
    if (this.reportFrames >= sampleRate / 10) {
      this.reportFrames = 0;
      this.port.postMessage({ type: 'reduction', value: -this.reduction });
    }
    return true;
  }
}
registerProcessor('compressor-processor', CompressorProcessor);
