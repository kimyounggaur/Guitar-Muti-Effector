export type PedalType =
  | 'tuner'
  | 'noiseGate'
  | 'compressor'
  | 'drive'
  | 'ampEQ'
  | 'cabinetIR'
  | 'modulation'
  | 'delay'
  | 'reverb'
  | 'looper'
  | 'rhythm';

export type PedalParamValue = number | string | boolean;

export type Pedal = {
  id: string;
  type: PedalType;
  name: string;
  enabled: boolean;
  bypassed: boolean;
  params: Record<string, PedalParamValue>;
};

export interface EffectNodeWrapper {
  id: string;
  type: PedalType;
  input: AudioNode;
  output: AudioNode;
  connect(destination: AudioNode): void;
  disconnect(): void;
  setParam(name: string, value: PedalParamValue): void;
  setBypass(bypassed: boolean): void;
  dispose(): void;
}

export const createDefaultPedals = (): Pedal[] => [
  {
    id: 'tuner',
    type: 'tuner',
    name: 'Tuner',
    enabled: true,
    bypassed: false,
    params: { referenceHz: 440, mute: false },
  },
  {
    id: 'noise-gate',
    type: 'noiseGate',
    name: 'Noise Gate',
    enabled: true,
    bypassed: false,
    params: { thresholdDb: -48, releaseMs: 180 },
  },
  {
    id: 'compressor',
    type: 'compressor',
    name: 'Compressor',
    enabled: true,
    bypassed: false,
    params: { thresholdDb: -24, ratio: 4, makeupGainDb: 0 },
  },
  {
    id: 'drive',
    type: 'drive',
    name: 'Drive',
    enabled: true,
    bypassed: false,
    params: { gain: 5, tone: 0.55, level: 0.8 },
  },
  {
    id: 'amp-eq',
    type: 'ampEQ',
    name: 'Amp EQ',
    enabled: true,
    bypassed: false,
    params: { bassDb: 2, midDb: -1, trebleDb: 2, presenceDb: 1 },
  },
  {
    id: 'cabinet-ir',
    type: 'cabinetIR',
    name: 'Cabinet IR',
    enabled: true,
    bypassed: false,
    params: { cabinet: 'Cab IR', mix: 1 },
  },
  {
    id: 'delay',
    type: 'delay',
    name: 'Delay',
    enabled: true,
    bypassed: false,
    params: { timeMs: 320, feedback: 0.28, mix: 0.22 },
  },
  {
    id: 'reverb',
    type: 'reverb',
    name: 'Reverb',
    enabled: true,
    bypassed: false,
    params: { size: 0.45, damping: 0.4, mix: 0.18 },
  },
];
