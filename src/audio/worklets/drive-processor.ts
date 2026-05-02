// @ts-nocheck
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const valueAt = (parameters, key, index) => {
  const values = parameters[key];
  return values.length > 1 ? values[index] : values[0];
};

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

registerProcessor('drive-processor', DriveProcessor);
