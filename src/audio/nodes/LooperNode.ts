export class LooperNode {
  readonly input: GainNode;
  readonly output: GainNode;

  constructor(context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.input.connect(this.output);
  }
}
