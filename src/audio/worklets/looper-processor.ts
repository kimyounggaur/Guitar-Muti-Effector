type LooperMode = 'idle' | 'recording' | 'playing' | 'overdubbing' | 'stopped';
type QuantizeMode = 'off' | '1bar' | '2bar' | '4bar';

declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

const MAX_SECONDS = 180;
const CHANNELS = 2;

class LooperProcessor extends AudioWorkletProcessor {
  private readonly maxSamples = Math.floor(sampleRate * MAX_SECONDS);
  private readonly buffer = new Float32Array(this.maxSamples * CHANNELS);
  private undoBuffer: Float32Array | null = null;
  private mode: LooperMode = 'idle';
  private loopLength = 0;
  private position = 0;
  private level = 0.85;
  private overdubLevel = 0.85;
  private feedback = 1;
  private quantize: QuantizeMode = 'off';
  private reverse = false;
  private halfSpeed = false;
  private framesSinceReport = 0;
  private hasUndo = false;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    this.reportState();
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0] ?? [];
    const output = outputs[0] ?? [];
    const leftIn = input[0];
    const rightIn = input[1] ?? leftIn;
    const leftOut = output[0];
    const rightOut = output[1] ?? leftOut;

    if (!leftOut) {
      return true;
    }

    for (let frame = 0; frame < leftOut.length; frame += 1) {
      const inL = leftIn?.[frame] ?? 0;
      const inR = rightIn?.[frame] ?? inL;
      let loopL = 0;
      let loopR = 0;

      if (this.mode === 'recording') {
        if (this.loopLength < this.maxSamples) {
          this.writeFrame(this.loopLength, inL, inR);
          this.loopLength += 1;
          this.position = this.loopLength;
        } else {
          this.finishRecording();
        }
      } else if (this.hasLoop() && (this.mode === 'playing' || this.mode === 'overdubbing')) {
        const readPosition = this.reverse ? this.loopLength - 1 - this.position : this.position;
        const sample = this.readInterpolated(readPosition);
        loopL = sample.left * this.level;
        loopR = sample.right * this.level;

        if (this.mode === 'overdubbing') {
          const writeIndex = this.wrapIndex(Math.floor(readPosition));
          const offset = writeIndex * CHANNELS;
          this.buffer[offset] = this.buffer[offset] * this.feedback + inL * this.overdubLevel;
          this.buffer[offset + 1] = this.buffer[offset + 1] * this.feedback + inR * this.overdubLevel;
        }

        this.advancePosition();
      }

      leftOut[frame] = loopL;
      if (rightOut) {
        rightOut[frame] = loopR;
      }
    }

    this.framesSinceReport += leftOut.length;
    if (this.framesSinceReport >= 2048) {
      this.framesSinceReport = 0;
      this.reportState();
    }

    return true;
  }

  private handleMessage(data: unknown) {
    if (!data || typeof data !== 'object') {
      return;
    }

    const message = data as { type?: string; name?: string; value?: unknown; command?: string };

    if (message.type === 'param' && typeof message.name === 'string') {
      this.setParam(message.name, message.value);
      return;
    }

    if (message.type === 'command' && typeof message.command === 'string') {
      this.handleCommand(message.command);
    }
  }

  private setParam(name: string, value: unknown) {
    if (name === 'level') {
      this.level = percentToUnit(value, 85);
    }

    if (name === 'overdubLevel') {
      this.overdubLevel = percentToUnit(value, 85);
    }

    if (name === 'feedback') {
      this.feedback = percentToUnit(value, 100);
    }

    if (name === 'quantize') {
      this.quantize = readQuantize(value);
    }

    if (name === 'reverse') {
      this.reverse = value === true;
    }

    if (name === 'halfSpeed') {
      this.halfSpeed = value === true;
    }
  }

  private handleCommand(command: string) {
    if (command === 'record') {
      this.record();
    }

    if (command === 'play') {
      this.play();
    }

    if (command === 'overdub') {
      this.overdub();
    }

    if (command === 'stop') {
      this.stop();
    }

    if (command === 'clear') {
      this.clear();
    }

    if (command === 'undo') {
      this.undo();
    }

    this.reportState();
  }

  private record() {
    if (this.mode === 'recording') {
      this.finishRecording();
      return;
    }

    this.clear(false);
    this.mode = 'recording';
    this.loopLength = 0;
    this.position = 0;
  }

  private play() {
    if (this.mode === 'recording') {
      this.finishRecording();
      return;
    }

    if (this.hasLoop()) {
      this.mode = 'playing';
    }
  }

  private overdub() {
    if (!this.hasLoop()) {
      this.record();
      return;
    }

    if (this.mode === 'overdubbing') {
      this.mode = 'playing';
      return;
    }

    this.undoBuffer = this.buffer.slice(0, this.loopLength * CHANNELS);
    this.hasUndo = true;
    this.mode = 'overdubbing';
  }

  private stop() {
    if (this.mode === 'recording') {
      this.finishRecording();
      this.mode = 'stopped';
      return;
    }

    if (this.hasLoop()) {
      this.mode = 'stopped';
    }
  }

  private clear(report = true) {
    this.buffer.fill(0, 0, Math.max(0, this.loopLength * CHANNELS));
    this.undoBuffer = null;
    this.hasUndo = false;
    this.loopLength = 0;
    this.position = 0;
    this.mode = 'idle';

    if (report) {
      this.reportState();
    }
  }

  private undo() {
    if (!this.undoBuffer || !this.hasLoop()) {
      return;
    }

    this.buffer.set(this.undoBuffer, 0);
    this.undoBuffer = null;
    this.hasUndo = false;
    this.mode = 'playing';
  }

  private finishRecording() {
    if (this.loopLength < Math.floor(sampleRate * 0.18)) {
      this.clear(false);
      return;
    }

    this.loopLength = this.quantizeLength(this.loopLength);
    this.position = 0;
    this.mode = 'playing';
  }

  private quantizeLength(length: number) {
    if (this.quantize === 'off') {
      return length;
    }

    const bars = this.quantize === '1bar' ? 1 : this.quantize === '2bar' ? 2 : 4;
    const barSamples = sampleRate * 2;
    return Math.min(this.maxSamples, Math.max(1, Math.round(length / (barSamples * bars)) * barSamples * bars));
  }

  private writeFrame(index: number, left: number, right: number) {
    const offset = index * CHANNELS;
    this.buffer[offset] = left;
    this.buffer[offset + 1] = right;
  }

  private readInterpolated(position: number) {
    const baseIndex = this.wrapIndex(Math.floor(position));
    const nextIndex = this.wrapIndex(baseIndex + 1);
    const fraction = position - Math.floor(position);
    const baseOffset = baseIndex * CHANNELS;
    const nextOffset = nextIndex * CHANNELS;
    return {
      left: lerp(this.buffer[baseOffset], this.buffer[nextOffset], fraction),
      right: lerp(this.buffer[baseOffset + 1], this.buffer[nextOffset + 1], fraction),
    };
  }

  private advancePosition() {
    this.position += this.halfSpeed ? 0.5 : 1;

    if (this.position >= this.loopLength) {
      this.position %= this.loopLength;
    }
  }

  private wrapIndex(index: number) {
    if (!this.hasLoop()) {
      return 0;
    }

    return ((index % this.loopLength) + this.loopLength) % this.loopLength;
  }

  private hasLoop() {
    return this.loopLength > 0;
  }

  private reportState() {
    this.port.postMessage({
      type: 'state',
      state: this.mode,
      position: this.hasLoop() ? this.position : 0,
      length: this.loopLength,
      durationSec: this.loopLength / sampleRate,
      progress: this.hasLoop() ? this.position / this.loopLength : 0,
      hasLoop: this.hasLoop(),
      canUndo: this.hasUndo,
      reverse: this.reverse,
      halfSpeed: this.halfSpeed,
    });
  }
}

const percentToUnit = (value: unknown, fallback: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(1, Math.max(0, numberValue / 100));
};

const readQuantize = (value: unknown): QuantizeMode => {
  if (value === '1bar' || value === '2bar' || value === '4bar') {
    return value;
  }

  return 'off';
};

const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

registerProcessor('looper-processor', LooperProcessor);
