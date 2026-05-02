import { Pedal } from '../types';
import { createReverbImpulse } from '../utils/impulse';
import { BaseEffect, EffectCore, ParamControl } from './BaseEffect';

export class ReverbEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(_pedal: Pedal): EffectCore {
    const controls = new Map<string, ParamControl>();
    const preDelay = this.context.createDelay(0.12);
    const convolver = this.context.createConvolver();
    const damping = this.context.createBiquadFilter();

    convolver.normalize = true;
    convolver.buffer = createReverbImpulse(this.context);
    damping.type = 'lowpass';
    damping.Q.value = 0.55;

    preDelay.connect(convolver);
    convolver.connect(damping);

    controls.set('size', { param: preDelay.delayTime, transform: (value) => 0.006 + value * 0.09 });
    controls.set('damping', { param: damping.frequency, transform: (value) => 9200 - value * 6900 });

    return { input: preDelay, output: damping, nodes: [preDelay, convolver, damping], controls };
  }
}
