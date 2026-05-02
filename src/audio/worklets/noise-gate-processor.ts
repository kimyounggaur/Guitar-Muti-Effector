// @ts-nocheck
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

registerProcessor('noise-gate-processor', NoiseGateProcessor);
