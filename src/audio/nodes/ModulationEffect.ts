import { Pedal } from '../types';
import { BaseEffect, EffectCore, ParamControl } from './BaseEffect';

export class ModulationEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(_pedal: Pedal): EffectCore {
    const controls = new Map<string, ParamControl>();
    const input = this.context.createGain();
    const delay = this.context.createDelay(0.03);
    const depth = this.context.createGain();
    const lfo = this.context.createOscillator();
    const output = this.context.createGain();

    delay.delayTime.value = 0.012;
    depth.gain.value = 0.004;
    lfo.frequency.value = 0.7;
    lfo.connect(depth);
    depth.connect(delay.delayTime);
    input.connect(delay);
    delay.connect(output);
    lfo.start();

    controls.set('rate', { param: lfo.frequency });
    controls.set('depth', { param: depth.gain, transform: (value) => value * 0.012 });

    return { input, output, nodes: [input, delay, depth, lfo, output], controls };
  }
}
