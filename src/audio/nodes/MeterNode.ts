export type MeterReading = {
  rms: number;
  peak: number;
  rmsDb: number;
  peakDb: number;
  level: number;
  isLow: boolean;
  isWarning: boolean;
  isClipping: boolean;
};

const MIN_DB = -60;

export const emptyMeterReading: MeterReading = {
  rms: 0,
  peak: 0,
  rmsDb: MIN_DB,
  peakDb: MIN_DB,
  level: 0,
  isLow: true,
  isWarning: false,
  isClipping: false,
};

export class MeterNode {
  readonly input: AnalyserNode;
  readonly output: AnalyserNode;
  private buffer: Float32Array<ArrayBuffer> | null = null;

  constructor(context: AudioContext) {
    this.input = context.createAnalyser();
    this.output = this.input;
    this.input.fftSize = 2048;
    this.input.smoothingTimeConstant = 0.78;
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
    const rmsDb = gainToDb(rms);
    const peakDb = gainToDb(peak);

    return {
      rms,
      peak,
      rmsDb,
      peakDb,
      level: dbToMeterLevel(rmsDb),
      isLow: rmsDb < -50,
      isWarning: peakDb >= -3,
      isClipping: peakDb >= -1,
    };
  }
}

const gainToDb = (gain: number) => Math.max(MIN_DB, 20 * Math.log10(Math.max(gain, 0.000001)));

const dbToMeterLevel = (db: number) => Math.min(1, Math.max(0, (db - MIN_DB) / Math.abs(MIN_DB)));
