export const createCabinetImpulse = (context: AudioContext) => {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * 0.075);
  const buffer = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    data[0] = 1;

    for (let index = 1; index < length; index += 1) {
      const time = index / sampleRate;
      const seed = ((index * 16807 + channel * 48271) % 2147483647) / 2147483647;
      const noise = seed * 2 - 1;
      const cone = Math.sin(2 * Math.PI * 112 * time) * Math.exp(-time * 44);
      const paper = Math.sin(2 * Math.PI * 390 * time + channel * 0.2) * Math.exp(-time * 80);
      data[index] = (cone * 0.34 + paper * 0.12 + noise * 0.055) * Math.exp(-time * 32);
    }
  }

  return buffer;
};

export const createReverbImpulse = (context: AudioContext, seconds = 1.9, decay = 2.7) => {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * seconds);
  const buffer = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);

    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      const seed = ((index * 48271 + channel * 69621) % 2147483647) / 2147483647;
      const noise = seed * 2 - 1;
      data[index] = noise * (1 - index / length) ** decay * Math.exp(-time * 0.35);
    }
  }

  return buffer;
};
