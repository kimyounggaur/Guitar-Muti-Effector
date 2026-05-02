import { Pedal } from '../types';
import { createCabinetImpulse } from '../utils/impulse';
import { BaseEffect, EffectCore, ParamControl } from './BaseEffect';

export class CabinetIREffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(_pedal: Pedal): EffectCore {
    const controls = new Map<string, ParamControl>();
    const lowCut = this.context.createBiquadFilter();
    const body = this.context.createBiquadFilter();
    const convolver = this.context.createConvolver();
    const air = this.context.createBiquadFilter();

    lowCut.type = 'highpass';
    lowCut.frequency.value = 70;
    lowCut.Q.value = 0.5;
    body.type = 'lowshelf';
    body.frequency.value = 180;
    air.type = 'lowpass';
    air.Q.value = 0.72;
    convolver.normalize = true;
    convolver.buffer = createCabinetImpulse(this.context);

    lowCut.connect(body);
    body.connect(convolver);
    convolver.connect(air);

    controls.set('body', { param: body.gain, transform: (value) => -5 + value * 11 });
    controls.set('air', { param: air.frequency, transform: (value) => 2600 + value * 6400 });

    return { input: lowCut, output: air, nodes: [lowCut, body, convolver, air], controls };
  }
}
