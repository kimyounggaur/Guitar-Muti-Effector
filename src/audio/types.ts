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
    name: 'COMP',
    enabled: true,
    bypassed: false,
    params: { threshold: -28, ratio: 3.5, attack: 0.012, release: 0.22, knee: 18, sustain: 42, mix: 78, level: 72 },
  },
  {
    id: 'drive',
    type: 'drive',
    name: 'DRIVE',
    enabled: true,
    bypassed: false,
    params: { mode: 'overdrive', drive: 48, tone: 58, level: 72, mix: 100, bias: 0 },
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
