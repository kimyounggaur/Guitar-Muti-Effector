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
    name: 'AMP EQ',
    enabled: true,
    bypassed: false,
    params: { lowCut: 70, bass: 2, mid: -1, midFreq: 760, midQ: 0.9, treble: 2, presence: 1, level: 72 },
  },
  {
    id: 'cabinet-ir',
    type: 'cabinetIR',
    name: 'CAB IR',
    enabled: true,
    bypassed: false,
    params: { cabinetType: '2x12', mic: 'dynamic', lowCut: 80, highCut: 6500, mix: 100, level: 72 },
  },
  {
    id: 'delay',
    type: 'delay',
    name: 'DELAY',
    enabled: true,
    bypassed: false,
    params: {
      mode: 'digital',
      timeMs: 420,
      feedback: 0.32,
      mix: 28,
      tone: 62,
      sync: false,
      bpm: 120,
      division: '1/4',
      flutter: 0,
    },
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
