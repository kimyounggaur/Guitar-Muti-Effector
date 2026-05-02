import { Pedal, getParamDefault } from '../types';
import { clamp } from '../utils/curves';
import { safeDisconnect, smoothAudioParam } from '../utils/smoothing';

export type ParamControl = {
  param: AudioParam;
  transform?: (value: number) => number;
  timeConstant?: number;
};

export type EffectCore = {
  input: AudioNode;
  output: AudioNode;
  nodes: AudioNode[];
  controls: Map<string, ParamControl>;
};

export type PedalUnit = {
  input: GainNode;
  output: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  levelGain: GainNode;
  controls: Map<string, ParamControl>;
  nodes: AudioNode[];
};

export abstract class BaseEffect {
  protected constructor(protected readonly context: AudioContext) {}

  abstract create(pedal: Pedal): EffectCore;

  protected getParam(pedal: Pedal, key: string) {
    return pedal.params[key] ?? getParamDefault(pedal.type, key);
  }

  protected mapWorkletParams(node: AudioWorkletNode, controls: Map<string, ParamControl>, keys: string[]) {
    keys.forEach((key) => {
      const param = node.parameters.get(key);
      if (param) {
        controls.set(key, { param });
      }
    });
  }
}

export const createPedalUnit = (context: AudioContext, pedal: Pedal, core: EffectCore): PedalUnit => {
  const input = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const mixBus = context.createGain();
  const levelGain = context.createGain();
  const output = context.createGain();
  const unit: PedalUnit = {
    input,
    output,
    dryGain,
    wetGain,
    levelGain,
    controls: core.controls,
    nodes: [mixBus, ...core.nodes],
  };

  input.connect(dryGain);
  dryGain.connect(mixBus);
  input.connect(core.input);
  core.output.connect(wetGain);
  wetGain.connect(mixBus);
  mixBus.connect(levelGain);
  levelGain.connect(output);

  applyPedalState(context, unit, pedal, true);
  applyPedalParams(context, unit, pedal, true);
  return unit;
};

export const applyPedalState = (context: AudioContext, unit: PedalUnit, pedal: Pedal, immediate = false) => {
  const active = pedal.enabled && !pedal.bypassed;
  const mix = active ? clamp(pedal.mix, 0, 1) : 0;
  const level = active ? clamp(pedal.level, 0, 1.5) : 1;

  setGain(context, unit.dryGain.gain, active ? 1 - mix : 1, immediate);
  setGain(context, unit.wetGain.gain, active ? mix : 0, immediate);
  setGain(context, unit.levelGain.gain, level, immediate);
};

export const applyPedalParams = (context: AudioContext, unit: PedalUnit, pedal: Pedal, immediate = false) => {
  unit.controls.forEach((control, key) => {
    const rawValue = pedal.params[key] ?? getParamDefault(pedal.type, key);
    const value = control.transform ? control.transform(rawValue) : rawValue;

    if (immediate) {
      control.param.value = value;
      return;
    }

    smoothAudioParam(context, control.param, value, control.timeConstant ?? 0.02);
  });
};

export const disconnectPedalUnit = (unit: PedalUnit) => {
  [
    unit.input,
    unit.output,
    unit.dryGain,
    unit.wetGain,
    unit.levelGain,
    ...unit.nodes,
  ].forEach(safeDisconnect);
};

const setGain = (context: AudioContext, param: AudioParam, value: number, immediate = false) => {
  if (immediate) {
    param.value = value;
    return;
  }

  smoothAudioParam(context, param, value, 0.012);
};
