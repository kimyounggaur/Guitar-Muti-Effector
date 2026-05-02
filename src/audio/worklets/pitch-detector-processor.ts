// @ts-nocheck
class PitchDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = 0;
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

    this.frame += output[0]?.length ?? 0;
    if (this.frame >= sampleRate / 8) {
      this.port.postMessage({ type: 'pitch-frame' });
      this.frame = 0;
    }

    return true;
  }
}

registerProcessor('pitch-detector-processor', PitchDetectorProcessor);
