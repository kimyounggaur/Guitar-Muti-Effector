export type EffectType =
  | 'noiseGate'
  | 'compressor'
  | 'drive'
  | 'ampEq'
  | 'cabinet'
  | 'delay'
  | 'reverb';

export type ParameterKind = 'db' | 'ms' | 'ratio' | 'percent' | 'hz';

export type PedalParamDefinition = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  kind: ParameterKind;
};

export type EffectDefinition = {
  type: EffectType;
  label: string;
  shortLabel: string;
  accent: string;
  description: string;
  defaultMix: number;
  defaultLevel: number;
  params: PedalParamDefinition[];
};

export type Pedal = {
  id: string;
  type: EffectType;
  label: string;
  enabled: boolean;
  bypassed: boolean;
  mix: number;
  level: number;
  params: Record<string, number>;
};

export type Preset = {
  id: string;
  name: string;
  createdAt: number;
  pedals: Pedal[];
  masterVolume: number;
};

export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  {
    type: 'noiseGate',
    label: 'Noise Gate',
    shortLabel: 'Gate',
    accent: '#35d0a3',
    description: 'Tames input hiss before the gain stages.',
    defaultMix: 1,
    defaultLevel: 1,
    params: [
      { key: 'threshold', label: 'Threshold', min: -70, max: -10, step: 1, defaultValue: -48, kind: 'db' },
      { key: 'attack', label: 'Attack', min: 1, max: 80, step: 1, defaultValue: 8, kind: 'ms' },
      { key: 'release', label: 'Release', min: 30, max: 700, step: 5, defaultValue: 180, kind: 'ms' },
    ],
  },
  {
    type: 'compressor',
    label: 'Compressor',
    shortLabel: 'Comp',
    accent: '#f6c85f',
    description: 'Smooths dynamics with native Web Audio compression.',
    defaultMix: 0.82,
    defaultLevel: 1,
    params: [
      { key: 'threshold', label: 'Threshold', min: -60, max: -6, step: 1, defaultValue: -28, kind: 'db' },
      { key: 'ratio', label: 'Ratio', min: 1, max: 20, step: 0.5, defaultValue: 4, kind: 'ratio' },
      { key: 'attack', label: 'Attack', min: 1, max: 120, step: 1, defaultValue: 14, kind: 'ms' },
      { key: 'release', label: 'Release', min: 30, max: 800, step: 5, defaultValue: 220, kind: 'ms' },
    ],
  },
  {
    type: 'drive',
    label: 'Drive',
    shortLabel: 'Drive',
    accent: '#ff7a59',
    description: 'AudioWorklet waveshaping for touch-sensitive saturation.',
    defaultMix: 0.92,
    defaultLevel: 0.9,
    params: [
      { key: 'drive', label: 'Gain', min: 1, max: 32, step: 0.1, defaultValue: 8, kind: 'ratio' },
      { key: 'tone', label: 'Tone', min: 0, max: 1, step: 0.01, defaultValue: 0.55, kind: 'percent' },
    ],
  },
  {
    type: 'ampEq',
    label: 'Amp EQ',
    shortLabel: 'EQ',
    accent: '#8fd3ff',
    description: 'Bass, mid, treble, and presence tone stack.',
    defaultMix: 1,
    defaultLevel: 1,
    params: [
      { key: 'bass', label: 'Bass', min: -12, max: 12, step: 0.5, defaultValue: 2, kind: 'db' },
      { key: 'mid', label: 'Mid', min: -12, max: 12, step: 0.5, defaultValue: -1.5, kind: 'db' },
      { key: 'treble', label: 'Treble', min: -12, max: 12, step: 0.5, defaultValue: 2.5, kind: 'db' },
      { key: 'presence', label: 'Presence', min: -9, max: 9, step: 0.5, defaultValue: 1.5, kind: 'db' },
    ],
  },
  {
    type: 'cabinet',
    label: 'Cabinet IR',
    shortLabel: 'Cab',
    accent: '#d7b38c',
    description: 'Generated cabinet impulse response with speaker filtering.',
    defaultMix: 1,
    defaultLevel: 1,
    params: [
      { key: 'body', label: 'Body', min: 0, max: 1, step: 0.01, defaultValue: 0.58, kind: 'percent' },
      { key: 'air', label: 'Air', min: 0, max: 1, step: 0.01, defaultValue: 0.42, kind: 'percent' },
    ],
  },
  {
    type: 'delay',
    label: 'Delay',
    shortLabel: 'Delay',
    accent: '#a6e267',
    description: 'Tempo-ready delay line with feedback and tone control.',
    defaultMix: 0.26,
    defaultLevel: 1,
    params: [
      { key: 'time', label: 'Time', min: 40, max: 900, step: 5, defaultValue: 330, kind: 'ms' },
      { key: 'feedback', label: 'Feedback', min: 0, max: 0.86, step: 0.01, defaultValue: 0.28, kind: 'percent' },
      { key: 'tone', label: 'Tone', min: 700, max: 8000, step: 50, defaultValue: 3600, kind: 'hz' },
    ],
  },
  {
    type: 'reverb',
    label: 'Reverb',
    shortLabel: 'Verb',
    accent: '#c49cff',
    description: 'AudioWorklet ambience with smooth size and damping.',
    defaultMix: 0.22,
    defaultLevel: 1,
    params: [
      { key: 'size', label: 'Size', min: 0, max: 1, step: 0.01, defaultValue: 0.48, kind: 'percent' },
      { key: 'damping', label: 'Damping', min: 0, max: 1, step: 0.01, defaultValue: 0.36, kind: 'percent' },
    ],
  },
];

export const getEffectDefinition = (type: EffectType) => {
  const definition = EFFECT_DEFINITIONS.find((effect) => effect.type === type);
  if (!definition) {
    throw new Error(`Unknown effect type: ${type}`);
  }
  return definition;
};

export const getParamDefault = (type: EffectType, key: string) => {
  return getEffectDefinition(type).params.find((param) => param.key === key)?.defaultValue ?? 0;
};

const createParams = (type: EffectType) => {
  const definition = getEffectDefinition(type);
  return Object.fromEntries(definition.params.map((param) => [param.key, param.defaultValue]));
};

const createPedal = (id: string, type: EffectType): Pedal => {
  const definition = getEffectDefinition(type);
  return {
    id,
    type,
    label: definition.label,
    enabled: true,
    bypassed: false,
    mix: definition.defaultMix,
    level: definition.defaultLevel,
    params: createParams(type),
  };
};

export const createInitialPedals = (): Pedal[] => [
  createPedal('gate', 'noiseGate'),
  createPedal('comp', 'compressor'),
  createPedal('drive', 'drive'),
  createPedal('eq', 'ampEq'),
  createPedal('cab', 'cabinet'),
  createPedal('delay', 'delay'),
  createPedal('verb', 'reverb'),
];

export const clonePedals = (pedals: Pedal[]): Pedal[] =>
  pedals.map((pedal) => ({
    ...pedal,
    params: { ...pedal.params },
  }));
