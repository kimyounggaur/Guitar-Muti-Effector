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

export const isPedalType = (value: unknown): value is PedalType =>
  value === 'tuner' ||
  value === 'noiseGate' ||
  value === 'compressor' ||
  value === 'drive' ||
  value === 'ampEQ' ||
  value === 'cabinetIR' ||
  value === 'modulation' ||
  value === 'delay' ||
  value === 'reverb' ||
  value === 'looper' ||
  value === 'rhythm';

export const isPedalParamValue = (value: unknown): value is PedalParamValue =>
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';

export const normalizePedalParams = (params: unknown): Record<string, PedalParamValue> => {
  if (!params || typeof params !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, PedalParamValue] => isPedalParamValue(entry[1])),
  );
};

export const normalizePedals = (pedals: unknown): Pedal[] => {
  const defaultPedals = createDefaultPedals();
  const defaultById = new Map(defaultPedals.map((pedal) => [pedal.id, pedal]));
  const sourcePedals = Array.isArray(pedals) ? pedals : [];
  const normalizedPedals = sourcePedals
    .filter((pedal): pedal is Partial<Pedal> => Boolean(pedal) && typeof pedal === 'object')
    .map((pedal) => {
      const id = typeof pedal.id === 'string' ? pedal.id : '';
      const fallback = defaultById.get(id);
      const type = isPedalType(pedal.type) ? pedal.type : fallback?.type;

      if (!id || !type) {
        return null;
      }

      return {
        id,
        type,
        name: typeof pedal.name === 'string' ? pedal.name : fallback?.name ?? id,
        enabled: typeof pedal.enabled === 'boolean' ? pedal.enabled : fallback?.enabled ?? true,
        bypassed: typeof pedal.bypassed === 'boolean' ? pedal.bypassed : fallback?.bypassed ?? false,
        params: {
          ...(fallback?.params ?? {}),
          ...normalizePedalParams(pedal.params),
        },
      };
    })
    .filter(Boolean) as Pedal[];
  const existingIds = new Set(normalizedPedals.map((pedal) => pedal.id));
  const missingPedals = defaultPedals.filter((pedal) => !existingIds.has(pedal.id));
  return [...normalizedPedals, ...missingPedals].map((pedal) => ({
    ...pedal,
    params: { ...pedal.params },
  }));
};

export const createDefaultPedals = (): Pedal[] => [
  {
    id: 'tuner',
    type: 'tuner',
    name: 'TUNER',
    enabled: true,
    bypassed: false,
    params: { referenceA4: 440, mode: 'guitar', sensitivity: 64, smoothing: 62 },
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
    id: 'modulation',
    type: 'modulation',
    name: 'MOD',
    enabled: true,
    bypassed: true,
    params: {
      mode: 'chorus',
      rate: 0.85,
      depth: 44,
      feedback: 0.18,
      mix: 42,
      tone: 68,
      stereoWidth: 52,
      sync: false,
      bpm: 120,
      division: '1/4',
    },
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
    name: 'REVERB',
    enabled: true,
    bypassed: false,
    params: { mode: 'room', decay: 0.9, preDelay: 22, lowCut: 120, highCut: 7600, mix: 24, level: 72 },
  },
  {
    id: 'looper',
    type: 'looper',
    name: 'LOOPER',
    enabled: true,
    bypassed: false,
    params: {
      level: 85,
      overdubLevel: 85,
      feedback: 100,
      quantize: 'off',
      reverse: false,
      halfSpeed: false,
    },
  },
  {
    id: 'rhythm',
    type: 'rhythm',
    name: 'RHYTHM',
    enabled: true,
    bypassed: false,
    params: {
      bpm: 120,
      pattern: 'metronome',
      volume: 70,
      playing: false,
    },
  },
];
