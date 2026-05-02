export class RhythmNode {
  readonly output: GainNode;

  constructor(private readonly context: AudioContext) {
    this.output = context.createGain();
    this.output.gain.value = 0;
  }

  pulse(frequency = 880, durationSeconds = 0.025) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;

    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.22, now + 0.002);
    envelope.gain.linearRampToValueAtTime(0, now + durationSeconds);
    oscillator.connect(envelope);
    envelope.connect(this.output);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.01);
  }
}
