export {};

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

/** Linked-channel gate: a single envelope prevents the stereo image shifting. */
class NoiseGateProcessor extends AudioWorkletProcessor {
  private threshold = Math.pow(10, -48 / 20);
  private attackMs = 8;
  private holdMs = 80;
  private releaseMs = 180;
  private envelope = 0;
  private gain = 0;
  private holdFrames = 0;
  private open = false;

  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent) => {
      if (!data || typeof data.value !== 'number' || !Number.isFinite(data.value)) return;
      const value = data.value;
      switch (data.name) {
        case 'thresholdDb': this.threshold = Math.pow(10, Math.max(-80, Math.min(0, value)) / 20); break;
        case 'attackMs': this.attackMs = Math.max(1, Math.min(200, value)); break;
        case 'holdMs': this.holdMs = Math.max(0, Math.min(1000, value)); break;
        case 'releaseMs': this.releaseMs = Math.max(10, Math.min(2000, value)); break;
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0] ?? [];
    const output = outputs[0] ?? [];
    const frames = output[0]?.length ?? 0;
    const envelopeRelease = Math.exp(-1 / (sampleRate * 0.012));
    const attackStep = 1 / (sampleRate * this.attackMs / 1000);
    const releaseStep = 1 / (sampleRate * this.releaseMs / 1000);
    for (let i = 0; i < frames; i++) {
      let peak = 0;
      for (const channel of input) peak = Math.max(peak, Math.abs(channel[i] ?? 0));
      this.envelope = Math.max(peak, this.envelope * envelopeRelease);
      // A 3 dB closing margin and hold time prevent chatter near the threshold.
      if (this.envelope >= this.threshold) {
        this.open = true;
        this.holdFrames = Math.round(sampleRate * this.holdMs / 1000);
      } else if (this.open && this.envelope < this.threshold * 0.707) {
        if (this.holdFrames > 0) this.holdFrames--;
        else this.open = false;
      }
      this.gain = this.open ? Math.min(1, this.gain + attackStep) : Math.max(0, this.gain - releaseStep);
      for (let channel = 0; channel < output.length; channel++) {
        output[channel][i] = (input[channel]?.[i] ?? input[0]?.[i] ?? 0) * this.gain;
      }
    }
    return true;
  }
}
registerProcessor('noise-gate-processor', NoiseGateProcessor);
