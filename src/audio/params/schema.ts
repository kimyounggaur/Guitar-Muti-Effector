// Single source of truth for pedal parameters (design §3.2).
// Defaults, engine clamps and on-screen ranges all read from PEDAL_SCHEMAS.
// Reconciliation of the previous three sources: docs/param-reconciliation.md.
import type { PedalParamValue, PedalType } from '../types';

export type ParamUnit = 'dB' | 'Hz' | 'ms' | 's' | '%';

export type NumberParamSpec = {
  kind: 'number';
  default: number;
  min: number;
  max: number;
  /** Value resolution. clampParam snaps to this grid. */
  step: number;
  /** Increment for on-screen +/- buttons and keyboard. Defaults to step. */
  uiStep?: number;
  unit?: ParamUnit;
  /** Message key (connected to src/i18n/ko.ts in P6d). */
  label: string;
  /** Safety ceiling the engine never exceeds, e.g. delay feedback 0.85. */
  safetyMax?: number;
};
export type EnumParamSpec<T extends string = string> = { kind: 'enum'; default: T; options: readonly T[]; label: string };
export type BoolParamSpec = { kind: 'bool'; default: boolean; label: string };
/** Free text (e.g. the name of an uploaded IR). Not part of the design's three kinds; kept minimal. */
export type TextParamSpec = { kind: 'text'; default: string; maxLength: number; label: string };
export type ParamSpec = NumberParamSpec | EnumParamSpec | BoolParamSpec | TextParamSpec;

const num = (
  pedal: string,
  name: string,
  def: number,
  min: number,
  max: number,
  step: number,
  extra: Partial<Pick<NumberParamSpec, 'unit' | 'uiStep' | 'safetyMax'>> = {},
): NumberParamSpec => ({ kind: 'number', default: def, min, max, step, label: `param.${pedal}.${name}`, ...extra });
const pct = (pedal: string, name: string, def: number) => num(pedal, name, def, 0, 100, 1, { unit: '%' });
const choice = <T extends string>(pedal: string, name: string, def: T, options: readonly T[]): EnumParamSpec<T> => ({
  kind: 'enum',
  default: def,
  options,
  label: `param.${pedal}.${name}`,
});
const flag = (pedal: string, name: string, def: boolean): BoolParamSpec => ({ kind: 'bool', default: def, label: `param.${pedal}.${name}` });

export const DRIVE_MODES = ['overdrive', 'crunch', 'distortion', 'fuzz'] as const;
export const CABINET_TYPES = ['1x12', '2x12', '4x12', 'openBack', 'custom'] as const;
export const CABINET_MICS = ['dynamic', 'ribbon', 'condenser', 'mixed'] as const;
export const MODULATION_MODES = ['chorus', 'flanger', 'phaser', 'tremolo', 'vibrato'] as const;
export const MODULATION_DIVISIONS = ['1/1', '1/2', '1/4', '1/8', 'dotted1/8', '1/16'] as const;
export const DELAY_MODES = ['digital', 'analog', 'tape', 'slapback', 'pingpong'] as const;
export const DELAY_DIVISIONS = ['1/4', '1/8', 'dotted1/8', '1/16'] as const;
export const REVERB_MODES = ['room', 'hall', 'plate', 'spring', 'ambient'] as const;
export const LOOPER_QUANTIZE = ['off', '1bar', '2bar', '4bar'] as const;
export const RHYTHM_PATTERNS = ['metronome', 'rock1', 'rock2', 'bluesShuffle', 'funk', 'ballad', 'sixEight', 'pop'] as const;
export const TUNER_MODES = ['chromatic', 'guitar', 'bass', 'ukulele'] as const;

/** Shared tempo range (tempoStore is the only place the tempo is stored). */
export const TEMPO = { default: 120, min: 40, max: 240 } as const;
export const clampTempo = (bpm: unknown): number =>
  typeof bpm === 'number' && Number.isFinite(bpm) ? Math.min(TEMPO.max, Math.max(TEMPO.min, bpm)) : TEMPO.default;

const EQ_GAIN = { unit: 'dB', uiStep: 0.5 } as const;

export const PEDAL_SCHEMAS = {
  tuner: {
    referenceA4: num('tuner', 'referenceA4', 440, 430, 450, 1, { unit: 'Hz' }),
    mode: choice('tuner', 'mode', 'guitar', TUNER_MODES),
    sensitivity: pct('tuner', 'sensitivity', 64),
    smoothing: pct('tuner', 'smoothing', 62),
  },
  noiseGate: {
    thresholdDb: num('noiseGate', 'thresholdDb', -48, -60, -10, 1, { unit: 'dB' }),
    attackMs: num('noiseGate', 'attackMs', 8, 1, 200, 1, { unit: 'ms' }),
    holdMs: num('noiseGate', 'holdMs', 80, 0, 1000, 1, { unit: 'ms' }),
    releaseMs: num('noiseGate', 'releaseMs', 180, 20, 500, 1, { unit: 'ms', uiStep: 5 }),
  },
  compressor: {
    threshold: num('compressor', 'threshold', -28, -60, -10, 1, { unit: 'dB' }),
    ratio: num('compressor', 'ratio', 3.5, 1, 20, 0.1),
    attack: num('compressor', 'attack', 0.012, 0.001, 0.1, 0.001, { unit: 's' }),
    release: num('compressor', 'release', 0.22, 0.05, 1, 0.01, { unit: 's' }),
    knee: num('compressor', 'knee', 18, 0, 40, 1, { unit: 'dB' }),
    sustain: pct('compressor', 'sustain', 42),
    mix: pct('compressor', 'mix', 78),
    level: pct('compressor', 'level', 72),
  },
  drive: {
    mode: choice('drive', 'mode', 'overdrive', DRIVE_MODES),
    drive: pct('drive', 'drive', 48),
    tone: pct('drive', 'tone', 58),
    level: pct('drive', 'level', 72),
    mix: pct('drive', 'mix', 100),
    bias: num('drive', 'bias', 0, -1, 1, 0.01),
  },
  ampEQ: {
    lowCut: num('ampEQ', 'lowCut', 70, 40, 160, 1, { unit: 'Hz' }),
    bass: num('ampEQ', 'bass', 2, -12, 12, 0.01, EQ_GAIN),
    mid: num('ampEQ', 'mid', -1, -12, 12, 0.01, EQ_GAIN),
    midFreq: num('ampEQ', 'midFreq', 760, 250, 1500, 1, { unit: 'Hz', uiStep: 10 }),
    midQ: num('ampEQ', 'midQ', 0.9, 0.3, 4, 0.01, { uiStep: 0.1 }),
    treble: num('ampEQ', 'treble', 2, -12, 12, 0.01, EQ_GAIN),
    presence: num('ampEQ', 'presence', 1, -12, 12, 0.01, EQ_GAIN),
    level: pct('ampEQ', 'level', 72),
  },
  cabinetIR: {
    cabinetType: choice('cabinetIR', 'cabinetType', '2x12', CABINET_TYPES),
    mic: choice('cabinetIR', 'mic', 'dynamic', CABINET_MICS),
    lowCut: num('cabinetIR', 'lowCut', 80, 40, 200, 1, { unit: 'Hz' }),
    highCut: num('cabinetIR', 'highCut', 6500, 3000, 12000, 1, { unit: 'Hz', uiStep: 100 }),
    mix: pct('cabinetIR', 'mix', 100),
    level: pct('cabinetIR', 'level', 72),
    customIRName: { kind: 'text', default: '', maxLength: 200, label: 'param.cabinetIR.customIRName' } as TextParamSpec,
  },
  modulation: {
    mode: choice('modulation', 'mode', 'chorus', MODULATION_MODES),
    rate: num('modulation', 'rate', 0.85, 0.05, 20, 0.01, { unit: 'Hz', uiStep: 0.05 }),
    depth: pct('modulation', 'depth', 44),
    feedback: num('modulation', 'feedback', 0.18, 0, 0.95, 0.01, { safetyMax: 0.95 }),
    mix: pct('modulation', 'mix', 42),
    tone: pct('modulation', 'tone', 68),
    stereoWidth: pct('modulation', 'stereoWidth', 52),
    sync: flag('modulation', 'sync', false),
    division: choice('modulation', 'division', '1/4', MODULATION_DIVISIONS),
  },
  delay: {
    mode: choice('delay', 'mode', 'digital', DELAY_MODES),
    timeMs: num('delay', 'timeMs', 420, 20, 2000, 1, { unit: 'ms', uiStep: 10 }),
    feedback: num('delay', 'feedback', 0.32, 0, 0.85, 0.01, { safetyMax: 0.85 }),
    mix: pct('delay', 'mix', 28),
    tone: pct('delay', 'tone', 62),
    sync: flag('delay', 'sync', false),
    division: choice('delay', 'division', '1/4', DELAY_DIVISIONS),
    flutter: pct('delay', 'flutter', 0),
  },
  reverb: {
    mode: choice('reverb', 'mode', 'room', REVERB_MODES),
    decay: num('reverb', 'decay', 0.9, 0.2, 10, 0.01, { unit: 's', uiStep: 0.1 }),
    preDelay: num('reverb', 'preDelay', 22, 0, 200, 1, { unit: 'ms' }),
    lowCut: num('reverb', 'lowCut', 120, 20, 500, 1, { unit: 'Hz' }),
    highCut: num('reverb', 'highCut', 7600, 1000, 12000, 1, { unit: 'Hz', uiStep: 100 }),
    mix: pct('reverb', 'mix', 24),
    level: pct('reverb', 'level', 72),
  },
  looper: {
    level: pct('looper', 'level', 85),
    overdubLevel: pct('looper', 'overdubLevel', 85),
    feedback: pct('looper', 'feedback', 100),
    quantize: choice('looper', 'quantize', 'off', LOOPER_QUANTIZE),
    reverse: flag('looper', 'reverse', false),
    halfSpeed: flag('looper', 'halfSpeed', false),
  },
  rhythm: {
    pattern: choice('rhythm', 'pattern', 'metronome', RHYTHM_PATTERNS),
    volume: pct('rhythm', 'volume', 70),
    playing: flag('rhythm', 'playing', false),
  },
} as const satisfies Record<PedalType, Record<string, ParamSpec>>;

type Schemas = Record<PedalType, Record<string, ParamSpec>>;
const schemas: Schemas = PEDAL_SCHEMAS;

export const getParamSpec = (type: PedalType, name: string): ParamSpec | undefined =>
  Object.prototype.hasOwnProperty.call(schemas[type] ?? {}, name) ? schemas[type][name] : undefined;

/** Number spec lookup for engine clamps; throws in development if the schema is missing an entry. */
export const numberSpec = (type: PedalType, name: string): NumberParamSpec => {
  const spec = getParamSpec(type, name);
  if (!spec || spec.kind !== 'number') throw new Error(`No number parameter ${type}.${name} in PEDAL_SCHEMAS`);
  return spec;
};

/** Clamp a value to the schema range (and safetyMax); fall back to the default when the type is wrong. */
export const clampNumberParam = (spec: NumberParamSpec, value: unknown): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : spec.default;
  const ceiling = Math.min(spec.max, spec.safetyMax ?? Infinity);
  const clamped = Math.min(ceiling, Math.max(spec.min, numeric));
  const snapped = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
  // Remove floating point noise from the snap (e.g. 0.8400000000000001 → 0.84).
  const decimals = Math.max(0, Math.ceil(-Math.log10(spec.step)) + 2);
  return Math.min(ceiling, Math.max(spec.min, Number(snapped.toFixed(decimals))));
};

export const clampParam = (type: PedalType, name: string, value: unknown): PedalParamValue => {
  const spec = getParamSpec(type, name);
  if (!spec) {
    return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : '';
  }
  if (spec.kind === 'number') return clampNumberParam(spec, value);
  if (spec.kind === 'enum') return typeof value === 'string' && spec.options.includes(value) ? value : spec.default;
  if (spec.kind === 'bool') return value === true;
  return typeof value === 'string' ? value.slice(0, spec.maxLength) : spec.default;
};

export const defaultParams = (type: PedalType): Record<string, PedalParamValue> =>
  Object.fromEntries(
    Object.entries(schemas[type]).filter(([, spec]) => spec.kind !== 'text').map(([name, spec]) => [name, spec.default]),
  );
