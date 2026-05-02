export type TunerMode = 'chromatic' | 'guitar' | 'bass' | 'ukulele';

export type PitchDetection = {
  frequency: number;
  rms: number;
  clarity: number;
};

export type NoteInfo = {
  noteName: string;
  octave: number;
  midi: number;
  cents: number;
  targetFrequency: number;
  targetLabel: string;
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const STANDARD_TUNINGS: Record<Exclude<TunerMode, 'chromatic'>, Array<{ label: string; midi: number }>> = {
  guitar: [
    { label: 'E2', midi: 40 },
    { label: 'A2', midi: 45 },
    { label: 'D3', midi: 50 },
    { label: 'G3', midi: 55 },
    { label: 'B3', midi: 59 },
    { label: 'E4', midi: 64 },
  ],
  bass: [
    { label: 'E1', midi: 28 },
    { label: 'A1', midi: 33 },
    { label: 'D2', midi: 38 },
    { label: 'G2', midi: 43 },
  ],
  ukulele: [
    { label: 'G4', midi: 67 },
    { label: 'C4', midi: 60 },
    { label: 'E4', midi: 64 },
    { label: 'A4', midi: 69 },
  ],
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const isTunerMode = (value: unknown): value is TunerMode =>
  value === 'chromatic' || value === 'guitar' || value === 'bass' || value === 'ukulele';

export const midiToFrequency = (midi: number, referenceA4 = 440) => referenceA4 * 2 ** ((midi - 69) / 12);

export const frequencyToMidi = (frequency: number, referenceA4 = 440) =>
  69 + 12 * Math.log2(frequency / referenceA4);

export const midiToNoteName = (midi: number) => {
  const roundedMidi = Math.round(midi);
  const noteName = NOTE_NAMES[((roundedMidi % 12) + 12) % 12];
  const octave = Math.floor(roundedMidi / 12) - 1;
  return { noteName, octave };
};

export const frequencyToNoteInfo = (frequency: number, referenceA4 = 440, mode: TunerMode = 'chromatic'): NoteInfo => {
  const targetMidi = findNearestTargetMidi(frequency, referenceA4, mode);
  const { noteName, octave } = midiToNoteName(targetMidi);
  const targetFrequency = midiToFrequency(targetMidi, referenceA4);
  const cents = 1200 * Math.log2(frequency / targetFrequency);

  return {
    noteName,
    octave,
    midi: targetMidi,
    cents,
    targetFrequency,
    targetLabel: `${noteName}${octave}`,
  };
};

export const findNearestTargetMidi = (frequency: number, referenceA4 = 440, mode: TunerMode = 'chromatic') => {
  if (mode === 'chromatic') {
    return Math.round(frequencyToMidi(frequency, referenceA4));
  }

  const tuning = STANDARD_TUNINGS[mode];
  return tuning.reduce((nearest, candidate) => {
    const nearestDistance = Math.abs(frequency - midiToFrequency(nearest.midi, referenceA4));
    const candidateDistance = Math.abs(frequency - midiToFrequency(candidate.midi, referenceA4));
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, tuning[0]).midi;
};

export const detectPitchYIN = (
  buffer: Float32Array<ArrayBufferLike>,
  sampleRate: number,
  minFrequency = 40,
  maxFrequency = 1000,
  threshold = 0.12,
): PitchDetection | null => {
  const rms = calculateRms(buffer);

  if (rms <= 0.0001) {
    return null;
  }

  const maxTau = Math.min(buffer.length - 2, Math.floor(sampleRate / minFrequency));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const yinBuffer = new Float32Array(maxTau + 1);

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = buffer.length - tau;

    for (let index = 0; index < limit; index += 1) {
      const delta = buffer[index] - buffer[index + tau];
      sum += delta * delta;
    }

    yinBuffer[tau] = sum;
  }

  let runningSum = 0;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = runningSum === 0 ? 1 : (yinBuffer[tau] * tau) / runningSum;
  }

  let tauEstimate = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 <= maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau += 1;
      }

      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate < 0) {
    return null;
  }

  const refinedTau = parabolicInterpolation(yinBuffer, tauEstimate);
  const frequency = sampleRate / refinedTau;

  if (!Number.isFinite(frequency) || frequency < minFrequency || frequency > maxFrequency) {
    return null;
  }

  return {
    frequency,
    rms,
    clarity: clamp(1 - yinBuffer[tauEstimate], 0, 1),
  };
};

export const calculateRms = (buffer: Float32Array<ArrayBufferLike>) => {
  let sum = 0;

  for (let index = 0; index < buffer.length; index += 1) {
    sum += buffer[index] * buffer[index];
  }

  return Math.sqrt(sum / buffer.length);
};

const parabolicInterpolation = (buffer: Float32Array<ArrayBufferLike>, tau: number) => {
  if (tau <= 0 || tau >= buffer.length - 1) {
    return tau;
  }

  const previous = buffer[tau - 1];
  const current = buffer[tau];
  const next = buffer[tau + 1];
  const divisor = previous + next - 2 * current;

  if (Math.abs(divisor) < 0.000001) {
    return tau;
  }

  return tau + (previous - next) / (2 * divisor);
};
