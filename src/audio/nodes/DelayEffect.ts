import { Pedal } from '../types';
import { clamp } from '../utils/curves';
import { BaseEffect, EffectCore, ParamControl } from './BaseEffect';

export class DelayEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(_pedal: Pedal): EffectCore {
    const controls = new Map<string, ParamControl>();
    const delay = this.context.createDelay(1.2);
    const feedback = this.context.createGain();
    const tone = this.context.createBiquadFilter();
    const output = this.context.createGain();

    tone.type = 'lowpass';
    tone.Q.value = 0.65;
    delay.connect(tone);
    tone.connect(output);
    tone.connect(feedback);
    feedback.connect(delay);

    controls.set('time', { param: delay.delayTime, transform: (value) => value / 1000, timeConstant: 0.025 });
    controls.set('feedback', { param: feedback.gain, transform: (value) => clamp(value, 0, 0.88) });
    controls.set('tone', { param: tone.frequency });

    return { input: delay, output, nodes: [delay, feedback, tone, output], controls };
  }
}
