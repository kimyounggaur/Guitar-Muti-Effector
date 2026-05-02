const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const valueAt = (parameters, key, index) => {
  const values = parameters[key];
  return values.length > 1 ? values[index] : values[0];
};

class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -48, minValue: -90, maxValue: 0, automationRate: 'a-rate' },
      { name: 'attack', defaultValue: 8, minValue: 0.5, maxValue: 200, automationRate: 'a-rate' },
      { name: 'release', defaultValue: 180, minValue: 5, maxValue: 1200, automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gateGain = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const frames = output[0]?.length ?? 0;

    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[channel] || input[0];
      const destination = output[channel];

      for (let index = 0; index < frames; index += 1) {
        const sample = source ? source[index] : 0;
        const threshold = 10 ** (valueAt(parameters, 'threshold', index) / 20);
        const attack = Math.max(valueAt(parameters, 'attack', index), 0.5) / 1000;
        const release = Math.max(valueAt(parameters, 'release', index), 1) / 1000;
        const rectified = Math.abs(sample);
        const envTime = rectified > this.envelope ? attack : release;
        const envCoef = Math.exp(-1 / (sampleRate * envTime));

        this.envelope = rectified + (this.envelope - rectified) * envCoef;

        const target = this.envelope >= threshold ? 1 : 0;
        const gainTime = target > this.gateGain ? attack : release;
        const gainCoef = Math.exp(-1 / (sampleRate * gainTime));
        this.gateGain = target + (this.gateGain - target) * gainCoef;

        destination[index] = sample * this.gateGain;
      }
    }

    return true;
  }
}

class DriveProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'drive', defaultValue: 8, minValue: 1, maxValue: 40, automationRate: 'a-rate' },
      { name: 'tone', defaultValue: 0.55, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    this.lowState = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const frames = output[0]?.length ?? 0;

    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[channel] || input[0];
      const destination = output[channel];
      this.lowState[channel] = this.lowState[channel] || 0;

      for (let index = 0; index < frames; index += 1) {
        const sample = source ? source[index] : 0;
        const drive = clamp(valueAt(parameters, 'drive', index), 1, 40);
        const tone = clamp(valueAt(parameters, 'tone', index), 0, 1);
        const pushed = sample * drive * 1.6;
        const shaped = Math.tanh(pushed) / Math.tanh(drive * 1.6);
        const alpha = 0.035 + tone * 0.42;

        this.lowState[channel] += alpha * (shaped - this.lowState[channel]);
        const high = shaped - this.lowState[channel];
        destination[index] = clamp(this.lowState[channel] * (1.15 - tone * 0.35) + high * (0.45 + tone), -1, 1);
      }
    }

    return true;
  }
}

class SimpleReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'size', defaultValue: 0.48, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
      { name: 'damping', defaultValue: 0.36, minValue: 0, maxValue: 1, automationRate: 'a-rate' },
    ];
  }

  constructor() {
    super();
    this.times = [
      [0.0297, 0.0371, 0.0411, 0.0533],
      [0.0311, 0.0397, 0.0437, 0.0571],
    ];
    this.lines = this.times.map((channelTimes) =>
      channelTimes.map((time) => new Float32Array(Math.max(2, Math.floor(sampleRate * time)))),
    );
    this.indices = this.lines.map((channelLines) => channelLines.map(() => 0));
    this.filters = this.lines.map((channelLines) => channelLines.map(() => 0));
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const frames = output[0]?.length ?? 0;

    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[channel] || input[0];
      const destination = output[channel];
      const reverbChannel = channel % this.lines.length;

      for (let frame = 0; frame < frames; frame += 1) {
        const dry = source ? source[frame] : 0;
        const size = clamp(valueAt(parameters, 'size', frame), 0, 1);
        const damping = clamp(valueAt(parameters, 'damping', frame), 0, 1);
        const feedback = 0.55 + size * 0.36;
        const inputGain = 0.22 + size * 0.18;
        const filterAlpha = 0.12 + (1 - damping) * 0.5;
        let wet = 0;

        for (let lineIndex = 0; lineIndex < this.lines[reverbChannel].length; lineIndex += 1) {
          const line = this.lines[reverbChannel][lineIndex];
          const index = this.indices[reverbChannel][lineIndex];
          const delayed = line[index];
          this.filters[reverbChannel][lineIndex] += filterAlpha * (delayed - this.filters[reverbChannel][lineIndex]);
          const filtered = this.filters[reverbChannel][lineIndex];
          const polarity = lineIndex % 2 === 0 ? 1 : -1;

          line[index] = dry * inputGain + filtered * feedback * polarity;
          this.indices[reverbChannel][lineIndex] = (index + 1) % line.length;
          wet += delayed * polarity;
        }

        destination[frame] = clamp(wet * 0.26, -1, 1);
      }
    }

    return true;
  }
}

registerProcessor('noise-gate-processor', NoiseGateProcessor);
registerProcessor('drive-processor', DriveProcessor);
registerProcessor('simple-reverb-processor', SimpleReverbProcessor);
