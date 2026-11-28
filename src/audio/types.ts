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

import { clampParam, defaultParams, getParamSpec } from './params/schema';

export type PedalParamValue = number | string | boolean;

/** Which interface input feeds the chain. */
export type InputChannel = '1' | '2' | 'mix';

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
  /** Tempo-aware effects (delay/modulation sync, looper quantize, rhythm) receive the shared tempo here. */
  setTempo?(bpm: number): void;
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

// Early boards stored wet mix as a 0–1 ratio (e.g. delay 0.22, reverb 0.18).
// Modern knobs and stored percentages use whole numbers. For the ambiguous value
// 1, convert only when the old pedal shape positively identifies a ratio.
function migrateMixPercent(type: PedalType | undefined, params: Record<string, unknown>) {
  const mix = params.mix;
  if (typeof mix !== 'number' || mix <= 0 || mix > 1) return params;
  if (type !== 'delay' && type !== 'reverb' && type !== 'cabinetIR' && type !== 'modulation') return params;
  const legacyShape = (type === 'cabinetIR' && 'cabinet' in params && !('cabinetType' in params))
    || (type === 'reverb' && 'size' in params && !('mode' in params))
    || (type === 'delay' && 'timeMs' in params && 'feedback' in params && !('mode' in params));
  return mix < 1 || legacyShape ? { ...params, mix: mix * 100 } : params;
}

/**
 * Normalises stored or imported parameters. Known parameters go through the schema (range, safetyMax,
 * enum options); unknown keys keep the previous behaviour (any primitive value), internal '__' keys are kept.
 * The tempo now lives in tempoStore only, so a stored params.bpm is dropped (see normalizePedals for migration).
 */
export const normalizePedalParams = (params: unknown, type?: PedalType): Record<string, PedalParamValue> => {
  if (!params || typeof params !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(migrateMixPercent(type, params as Record<string, unknown>))
      .filter((entry): entry is [string, PedalParamValue] => isPedalParamValue(entry[1]))
      .filter(([name]) => name !== 'bpm')
      .map(([name, value]) => [name, type && !name.startsWith('__') && getParamSpec(type, name) ? clampParam(type, name, value) : value]),
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
          ...normalizePedalParams(pedal.params, type),
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
  { id: 'tuner', type: 'tuner', name: 'TUNER', enabled: true, bypassed: false, params: defaultParams('tuner') },
  { id: 'noise-gate', type: 'noiseGate', name: 'Noise Gate', enabled: true, bypassed: false, params: defaultParams('noiseGate') },
  { id: 'compressor', type: 'compressor', name: 'COMP', enabled: true, bypassed: false, params: defaultParams('compressor') },
  { id: 'drive', type: 'drive', name: 'DRIVE', enabled: true, bypassed: false, params: defaultParams('drive') },
  { id: 'amp-eq', type: 'ampEQ', name: 'AMP EQ', enabled: true, bypassed: false, params: defaultParams('ampEQ') },
  { id: 'cabinet-ir', type: 'cabinetIR', name: 'CAB IR', enabled: true, bypassed: false, params: defaultParams('cabinetIR') },
  { id: 'modulation', type: 'modulation', name: 'MOD', enabled: true, bypassed: true, params: defaultParams('modulation') },
  { id: 'delay', type: 'delay', name: 'DELAY', enabled: true, bypassed: false, params: defaultParams('delay') },
  { id: 'reverb', type: 'reverb', name: 'REVERB', enabled: true, bypassed: false, params: defaultParams('reverb') },
  { id: 'looper', type: 'looper', name: 'LOOPER', enabled: true, bypassed: false, params: defaultParams('looper') },
  { id: 'rhythm', type: 'rhythm', name: 'RHYTHM', enabled: true, bypassed: false, params: defaultParams('rhythm') },
];
