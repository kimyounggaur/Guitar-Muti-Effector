// @ts-nocheck
class LooperProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'record', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'playback', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[channel] || input[0];
      const destination = output[channel];

      for (let index = 0; index < destination.length; index += 1) {
        destination[index] = source ? source[index] : 0;
      }
    }

    return true;
  }
}

registerProcessor('looper-processor', LooperProcessor);
