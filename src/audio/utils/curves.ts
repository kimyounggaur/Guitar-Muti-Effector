export type DriveMode = 'overdrive' | 'crunch' | 'distortion' | 'fuzz';

export const DRIVE_MODES: DriveMode[] = ['overdrive', 'crunch', 'distortion', 'fuzz'];

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const percentToUnit = (value: number, fallback = 0) => clamp(Number.isFinite(value) ? value : fallback, 0, 100) / 100;

export const isDriveMode = (value: unknown): value is DriveMode =>
  typeof value === 'string' && DRIVE_MODES.includes(value as DriveMode);

export const driveModeLabel = (mode: DriveMode) => {
  if (mode === 'overdrive') {
    return 'Overdrive';
  }

  if (mode === 'crunch') {
    return 'Crunch';
  }

  if (mode === 'distortion') {
    return 'Distortion';
  }

  return 'Fuzz';
};

export const createDriveCurve = (mode: DriveMode, drive: number, bias: number, samples = 4096) => {
  const curve = new Float32Array(samples);
  const amount = percentToUnit(drive, 50);
  const shapedBias = clamp(bias, -1, 1) * 0.32;

  for (let index = 0; index < samples; index += 1) {
    const x = (index / (samples - 1)) * 2 - 1;
    const shifted = x + shapedBias;
    curve[index] = processDriveSample(mode, shifted, amount) - processDriveSample(mode, shapedBias, amount) * 0.22;
  }

  return curve;
};

export const processDriveSample = (mode: DriveMode, sample: number, amount: number) => {
  const x = clamp(sample, -2.5, 2.5);

  if (mode === 'overdrive') {
    const gain = 1.5 + amount * 7;
    const asymmetry = x >= 0 ? 1 + amount * 0.28 : 1 - amount * 0.16;
    return Math.tanh(x * gain * asymmetry) / Math.tanh(gain);
  }

  if (mode === 'crunch') {
    const softGain = 2.2 + amount * 10;
    const soft = Math.tanh(x * softGain) / Math.tanh(softGain);
    const threshold = 0.78 - amount * 0.28;
    const hard = clamp(x * (1.2 + amount * 2.4), -threshold, threshold) / threshold;
    return soft * (0.66 - amount * 0.18) + hard * (0.34 + amount * 0.18);
  }

  if (mode === 'distortion') {
    const gain = 2.8 + amount * 20;
    const threshold = 0.66 - amount * 0.36;
    const clipped = clamp(x * gain, -threshold, threshold) / threshold;
    return Math.tanh(clipped * (1.4 + amount * 1.8));
  }

  const gain = 6 + amount * 42;
  const threshold = 0.28 - amount * 0.14;
  const clipped = clamp(x * gain, -threshold, threshold) / threshold;
  return Math.sign(clipped) * Math.abs(clipped) ** (0.42 - amount * 0.18);
};
