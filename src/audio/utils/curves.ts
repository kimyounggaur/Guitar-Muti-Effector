export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const equalPowerMix = (mix: number) => {
  const normalized = clamp(mix, 0, 1);
  return {
    dry: Math.cos(normalized * Math.PI * 0.5),
    wet: Math.sin(normalized * Math.PI * 0.5),
  };
};

export const createSoftClipCurve = (amount = 8, samples = 2048) => {
  const curve = new Float32Array(samples);
  const drive = Math.max(1, amount);

  for (let index = 0; index < samples; index += 1) {
    const x = (index / (samples - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * drive) / Math.tanh(drive);
  }

  return curve;
};
