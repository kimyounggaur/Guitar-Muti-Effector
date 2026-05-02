import { Pedal } from '../types';
import { BaseEffect, EffectCore } from './BaseEffect';

export class DriveEffect extends BaseEffect {
  constructor(context: AudioContext) {
    super(context);
  }

  create(pedal: Pedal): EffectCore {
    const controls = new Map();
    const drive = new AudioWorkletNode(this.context, 'drive-processor', {
      parameterData: {
        drive: this.getParam(pedal, 'drive'),
        tone: this.getParam(pedal, 'tone'),
      },
    });

    this.mapWorkletParams(drive, controls, ['drive', 'tone']);
    return { input: drive, output: drive, nodes: [drive], controls };
  }
}
