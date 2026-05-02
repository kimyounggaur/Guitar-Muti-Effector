export type ReverbMode = 'room' | 'hall' | 'plate' | 'spring' | 'ambient';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const readReverbMode = (value: unknown): ReverbMode => {
  if (value === 'room' || value === 'hall' || value === 'plate' || value === 'spring' || value === 'ambient') {
    return value;
  }

  return 'room';
};

export const reverbModeLabel = (mode: ReverbMode) => {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

export const reverbModeToIRUrl = (mode: ReverbMode) => {
  const baseUrl = import.meta.env.BASE_URL || '/';

  if (mode === 'room') {
    return `${baseUrl}irs/room.wav`;
  }

  if (mode === 'hall') {
    return `${baseUrl}irs/hall.wav`;
  }

  if (mode === 'plate') {
    return `${baseUrl}irs/plate.wav`;
  }

  if (mode === 'spring') {
    return `${baseUrl}irs/spring.wav`;
  }

  return null;
};

export const defaultDecayForMode = (mode: ReverbMode) => {
  if (mode === 'room') {
    return 0.9;
  }

  if (mode === 'hall') {
    return 3.6;
  }

  if (mode === 'plate') {
    return 2.2;
  }

  if (mode === 'spring') {
    return 1.7;
  }

  return 6.8;
};

export const createSyntheticReverbImpulse = (context: AudioContext, mode: ReverbMode, decaySeconds: number) => {
  const sampleRate = context.sampleRate;
  const decay = clamp(decaySeconds, 0.2, 10);
  const length = Math.max(1, Math.floor(sampleRate * decay));
  const buffer = context.createBuffer(2, length, sampleRate);
  const profile = modeProfile(mode);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);

    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      const progress = index / Math.max(1, length - 1);
      const envelope = Math.exp((-time * profile.decaySlope) / decay);
      const stereoOffset = channel === 0 ? 0 : 0.021;
      const denseNoise = seededNoise(index, channel);
      const early = earlyReflection(time, profile.earlyMs, stereoOffset);
      const modeTone = modalTexture(time, mode, channel);
      const shimmer = Math.sin(2 * Math.PI * (profile.brightness + channel * 17) * time) * profile.shimmer;
      const springDrip = mode === 'spring' ? Math.sin(2 * Math.PI * (85 + progress * 900) * time) * 0.18 : 0;
      const tail = (denseNoise * profile.diffusion + modeTone + shimmer + springDrip) * envelope;
      data[index] = (early + tail) * (1 - progress * profile.tailTrim);
    }
  }

  normalizeBuffer(buffer);
  return buffer;
};

const modeProfile = (mode: ReverbMode) => {
  if (mode === 'room') {
    return { diffusion: 0.48, decaySlope: 8.2, earlyMs: 24, brightness: 2400, shimmer: 0.012, tailTrim: 0.35 };
  }

  if (mode === 'hall') {
    return { diffusion: 0.72, decaySlope: 5.6, earlyMs: 48, brightness: 1800, shimmer: 0.018, tailTrim: 0.12 };
  }

  if (mode === 'plate') {
    return { diffusion: 0.8, decaySlope: 6.6, earlyMs: 18, brightness: 3900, shimmer: 0.036, tailTrim: 0.18 };
  }

  if (mode === 'spring') {
    return { diffusion: 0.42, decaySlope: 6.2, earlyMs: 32, brightness: 2700, shimmer: 0.02, tailTrim: 0.28 };
  }

  return { diffusion: 0.86, decaySlope: 4.1, earlyMs: 72, brightness: 1400, shimmer: 0.03, tailTrim: 0.04 };
};

const earlyReflection = (time: number, earlyMs: number, offset: number) => {
  const earlySeconds = earlyMs / 1000;
  const taps = [0.003 + offset, earlySeconds * 0.36 + offset, earlySeconds * 0.72 - offset * 0.4];
  return taps.reduce((sum, tap, index) => {
    const width = 0.0018 + index * 0.0012;
    const distance = Math.abs(time - tap);
    return sum + Math.max(0, 1 - distance / width) * (0.5 / (index + 1));
  }, 0);
};

const modalTexture = (time: number, mode: ReverbMode, channel: number) => {
  if (mode === 'plate') {
    return (
      Math.sin(2 * Math.PI * (520 + channel * 31) * time) * 0.035 +
      Math.sin(2 * Math.PI * (1420 + channel * 43) * time) * 0.02
    );
  }

  if (mode === 'spring') {
    return (
      Math.sin(2 * Math.PI * (255 + channel * 19) * time) * 0.052 +
      Math.sin(2 * Math.PI * (690 + channel * 23) * time) * 0.035
    );
  }

  return Math.sin(2 * Math.PI * (180 + channel * 13) * time) * 0.018;
};

const normalizeBuffer = (buffer: AudioBuffer) => {
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      peak = Math.max(peak, Math.abs(data[index]));
    }
  }

  if (peak <= 0) {
    return;
  }

  const gain = 0.82 / peak;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      data[index] *= gain;
    }
  }
};

const seededNoise = (index: number, channel: number) => {
  const value = Math.sin((index + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};
