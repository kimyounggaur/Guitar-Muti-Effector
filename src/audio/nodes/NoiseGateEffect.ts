import { Pedal } from '../types';
import { BaseEffect, EffectCore } from './BaseEffect';

export class NoiseGateEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(pedal: Pedal): EffectCore {
    const controls = new Map();
    const gate = new AudioWorkletNode(this.context, 'noise-gate-processor', {
      parameterData: {
        threshold: this.getParam(pedal, 'threshold'),
        attack: this.getParam(pedal, 'attack'),
        release: this.getParam(pedal, 'release'),
      },
    });

    this.mapWorkletParams(gate, controls, ['threshold', 'attack', 'release']);
    return { input: gate, output: gate, nodes: [gate], controls };
  }
}
