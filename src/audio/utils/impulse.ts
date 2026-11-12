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

// Cache a bounded number of impulse responses per context. Quantizing decay avoids
// generating hundreds of multi-megabyte buffers as a control is dragged.
const cache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
export const createSyntheticReverbImpulse = (context: AudioContext, mode: ReverbMode, decaySeconds: number) => {
  const decay = Math.round(clamp(decaySeconds, 0.2, 10) * 10) / 10;
  let entries = cache.get(context);
  if (!entries) { entries = new Map(); cache.set(context, entries); }
  const key = `${mode}:${decay}`;
  const cached = entries.get(key);
  if (cached) { entries.delete(key); entries.set(key, cached); return cached; }
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * decay));
  const buffer = context.createBuffer(2, length, sampleRate);
  const diffusion = { room: 0.65, hall: 0.9, plate: 0.85, spring: 0.72, ambient: 1 }[mode];
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let state = (channel + 1) * 1234567 + mode.length * 197;
    let filtered = 0;
    for (let i = 0; i < length; i++) {
      // Independent broadband noise avoids persistent tonal peaks in the tail.
      state = (Math.imul(state, 1664525) + 1013904223) | 0;
      const noise = ((state >>> 0) / 2147483648) - 1;
      filtered += (noise - filtered) * (mode === 'plate' ? 0.72 : 0.46);
      const t = i / sampleRate;
      const envelope = Math.exp(-6.91 * t / decay);
      // Sparse, broadband early reflections; no deterministic sinusoidal tones.
      const attack = Math.min(1, t / (mode === 'room' ? 0.006 : 0.018));
      data[i] = filtered * envelope * attack * diffusion;
    }
  }
  normalizeBuffer(buffer);
  entries.set(key, buffer);
  while (entries.size > 6) entries.delete(entries.keys().next().value!);
  return buffer;
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
