import { MeterReading } from '../types';
import { rmsToDb } from '../utils/db';
import { FloatAudioBuffer } from '../utils/pitch';

export class MeterNode {
  readonly input: AnalyserNode;
  readonly output: AnalyserNode;
  private buffer: FloatAudioBuffer | null = null;

  constructor(context: AudioContext, fftSize = 2048, smoothing = 0.78) {
    this.input = context.createAnalyser();
    this.output = this.input;
    this.input.fftSize = fftSize;
    this.input.smoothingTimeConstant = smoothing;
  }

  read(): MeterReading {
    if (!this.buffer || this.buffer.length !== this.input.fftSize) {
      this.buffer = new Float32Array(this.input.fftSize);
    }

    this.input.getFloatTimeDomainData(this.buffer);

    let sum = 0;
    let peak = 0;
    for (let index = 0; index < this.buffer.length; index += 1) {
      const sample = this.buffer[index];
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }

    const rms = Math.sqrt(sum / this.buffer.length);
    return { rms, peak, db: rmsToDb(rms) };
  }
}
