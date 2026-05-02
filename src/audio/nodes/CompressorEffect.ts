import { Pedal } from '../types';
import { BaseEffect, EffectCore, ParamControl } from './BaseEffect';

export class CompressorEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(_pedal: Pedal): EffectCore {
    const compressor = this.context.createDynamicsCompressor();
    const controls = new Map<string, ParamControl>();

    compressor.knee.value = 18;
    controls.set('threshold', { param: compressor.threshold });
    controls.set('ratio', { param: compressor.ratio });
    controls.set('attack', { param: compressor.attack, transform: (value) => value / 1000 });
    controls.set('release', { param: compressor.release, transform: (value) => value / 1000 });

    return { input: compressor, output: compressor, nodes: [compressor], controls };
  }
}
