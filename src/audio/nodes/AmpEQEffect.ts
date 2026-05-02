import { Pedal } from '../types';
import { BaseEffect, EffectCore, ParamControl } from './BaseEffect';

export class AmpEQEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(_pedal: Pedal): EffectCore {
    const controls = new Map<string, ParamControl>();
    const bass = this.context.createBiquadFilter();
    const mid = this.context.createBiquadFilter();
    const treble = this.context.createBiquadFilter();
    const presence = this.context.createBiquadFilter();

    bass.type = 'lowshelf';
    bass.frequency.value = 150;
    mid.type = 'peaking';
    mid.frequency.value = 760;
    mid.Q.value = 0.9;
    treble.type = 'highshelf';
    treble.frequency.value = 2600;
    presence.type = 'peaking';
    presence.frequency.value = 4200;
    presence.Q.value = 0.75;

    bass.connect(mid);
    mid.connect(treble);
    treble.connect(presence);

    controls.set('bass', { param: bass.gain });
    controls.set('mid', { param: mid.gain });
    controls.set('treble', { param: treble.gain });
    controls.set('presence', { param: presence.gain });

    return { input: bass, output: presence, nodes: [bass, mid, treble, presence], controls };
  }
}
