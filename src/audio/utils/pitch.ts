import { clamp } from './curves';

export type FloatAudioBuffer = Float32Array<ArrayBuffer>;

export type PitchDetection = {
  frequency: number | null;
  confidence: number;
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const detectPitch = (buffer: FloatAudioBuffer, sampleRate: number): PitchDetection => {
  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    sum += buffer[index] * buffer[index];
  }

  const rms = Math.sqrt(sum / buffer.length);
  if (rms < 0.006) {
    return { frequency: null, confidence: 0 };
  }

  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.min(Math.floor(sampleRate / 55), Math.floor(buffer.length / 2));
  let bestLag = -1;
  let bestCorrelation = 0;
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < buffer.length - lag; index += 1) {
      const a = buffer[index];
      const b = buffer[index + lag];
      correlation += a * b;
      normA += a * a;
      normB += b * b;
    }

    correlation = correlation / Math.sqrt(normA * normB || 1);
    correlations[lag] = correlation;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.55) {
    return { frequency: null, confidence: bestCorrelation };
  }

  const previous = correlations[bestLag - 1] ?? bestCorrelation;
  const next = correlations[bestLag + 1] ?? bestCorrelation;
  const correction = (next - previous) / (2 * (2 * bestCorrelation - previous - next) || 1);
  const refinedLag = bestLag + clamp(correction, -0.5, 0.5);

  return {
    frequency: sampleRate / refinedLag,
    confidence: bestCorrelation,
  };
};

export const pitchToTunerReading = (frequency: number | null, confidence: number) => {
  if (!frequency) {
    return { note: '--', frequency: null, cents: 0, confidence };
  }

  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const normalizedIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const targetFrequency = 440 * 2 ** ((midi - 69) / 12);
  const cents = Math.round(1200 * Math.log2(frequency / targetFrequency));

  return {
    note: `${NOTE_NAMES[normalizedIndex]}${octave}`,
    frequency,
    cents,
    confidence,
  };
};
