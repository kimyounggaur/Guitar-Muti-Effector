import { TunerReading } from '../types';
import { FloatAudioBuffer, detectPitch, pitchToTunerReading } from '../utils/pitch';

export class TunerNode {
  readonly input: AnalyserNode;
  readonly output: AnalyserNode;
  private buffer: FloatAudioBuffer | null = null;

  constructor(private readonly context: AudioContext) {
    this.input = context.createAnalyser();
    this.output = this.input;
    this.input.fftSize = 4096;
    this.input.smoothingTimeConstant = 0.72;
  }

  read(): TunerReading {
    if (!this.buffer || this.buffer.length !== this.input.fftSize) {
      this.buffer = new Float32Array(this.input.fftSize);
    }

    this.input.getFloatTimeDomainData(this.buffer);
    const result = detectPitch(this.buffer, this.context.sampleRate);
    return pitchToTunerReading(result.frequency, result.confidence);
  }
}
