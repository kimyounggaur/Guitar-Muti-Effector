import { create } from 'zustand';
import { Pedal, createDefaultPedals, normalizePedals } from '../audio/types';

export const PRESET_STORAGE_KEY = 'web-guitar-pedalboard-presets';

export type PresetOrigin = 'factory' | 'user' | 'imported';

export type PedalboardPreset = {
  id: string;
  name: string;
  category: string;
  origin: PresetOrigin;
  description: string;
  tags: string[];
  pedals: Pedal[];
  masterVolume: number;
  tempoBpm: number;
  createdAt: string;
  updatedAt: string;
};

export type PresetSnapshot = {
  pedals: Pedal[];
  masterVolume: number;
  tempoBpm: number;
};

type PresetMetadata = {
  category?: string;
  origin?: PresetOrigin;
  description?: string;
  tags?: string[];
};

type PresetStore = {
  presets: PedalboardPreset[];
  activePresetId: string | null;
  currentPresetName: string;
  hydratePresets: () => void;
  savePreset: (name: string, snapshot: PresetSnapshot) => PedalboardPreset;
  updateActivePreset: (snapshot: PresetSnapshot) => PedalboardPreset | null;
  loadPreset: (id: string) => PedalboardPreset | null;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string) => PedalboardPreset | null;
  importPresets: (json: string) => { imported: number; skipped: number };
  exportPresets: () => string;
};

const FACTORY_CREATED_AT = '2026-01-01T00:00:00.000Z';
const FACTORY_CATEGORIES = ['Clean', 'Bass', 'Lead', 'Crunch', 'High Gain', 'Ambient', 'Modulation', 'FX', 'Experimental'];
const LEGACY_FACTORY_IDS = new Set([
  'default-clean-practice',
  'default-blues-lead',
  'default-classic-rock',
  'default-high-gain',
  'default-ambient-delay',
  'default-fuzz-experiment',
]);

const clonePedals = (pedals: Pedal[]) => normalizePedals(pedals);

const createId = (prefix = 'preset') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nowIso = () => new Date().toISOString();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeName = (name: string, fallback = 'Untitled Preset') => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : fallback;
};

const sanitizeCategory = (category: unknown, fallback = 'User Presets') =>
  typeof category === 'string' && category.trim() ? category.trim().slice(0, 32) : fallback;

const sanitizeOrigin = (origin: unknown, fallback: PresetOrigin): PresetOrigin =>
  origin === 'factory' || origin === 'user' || origin === 'imported' ? origin : fallback;

const sanitizeTags = (tags: unknown): string[] =>
  Array.isArray(tags)
    ? [...new Set(tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map((tag) => tag.trim()))].slice(0, 10)
    : [];

const buildPreset = (
  id: string,
  name: string,
  snapshot: PresetSnapshot,
  createdAt = nowIso(),
  updatedAt = createdAt,
  metadata: PresetMetadata = {},
): PedalboardPreset => ({
  id,
  name: sanitizeName(name),
  category: sanitizeCategory(metadata.category, metadata.origin === 'factory' ? 'Clean' : 'User Presets'),
  origin: sanitizeOrigin(metadata.origin, 'user'),
  description: typeof metadata.description === 'string' ? metadata.description.trim().slice(0, 140) : '',
  tags: sanitizeTags(metadata.tags),
  pedals: clonePedals(snapshot.pedals),
  masterVolume: clamp(snapshot.masterVolume, 0, 1),
  tempoBpm: Math.round(clamp(snapshot.tempoBpm, 40, 240)),
  createdAt,
  updatedAt,
});

const withPedal = (
  pedals: Pedal[],
  id: string,
  patch: Partial<Pick<Pedal, 'enabled' | 'bypassed' | 'params'>>,
) =>
  pedals.map((pedal) =>
    pedal.id === id
      ? {
          ...pedal,
          enabled: patch.enabled ?? pedal.enabled,
          bypassed: patch.bypassed ?? pedal.bypassed,
          params: {
            ...pedal.params,
            ...(patch.params ?? {}),
          },
        }
      : pedal,
  );

const makeSnapshot = (masterVolume: number, tempoBpm: number, patches: Array<[string, Partial<Pedal>]>) => {
  let pedals = createDefaultPedals();
  patches.forEach(([id, patch]) => {
    pedals = withPedal(pedals, id, patch);
  });

  return { pedals, masterVolume, tempoBpm };
};

const pick = <T,>(values: T[], index: number) => values[index % values.length];
const varied = (base: number, index: number, step: number, min: number, max: number) =>
  clamp(base + (index - 5) * step, min, max);

type PresetBlueprint = {
  category: string;
  names: string[];
  tags: string[];
  tempoBase: number;
  masterVolume: number;
  makePatches: (index: number) => Array<[string, Partial<Pedal>]>;
  describe: (name: string, index: number) => string;
};

const cleanBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -58 + (index % 4) * 2, releaseMs: 170 } }],
  ['compressor', { params: { sustain: 28 + (index % 6) * 5, mix: 62 + (index % 4) * 6, level: 72 } }],
  [
    'drive',
    {
      bypassed: index !== 8,
      params: { mode: 'overdrive', drive: 8 + (index % 4) * 4, tone: 50 + (index % 5) * 5, level: 72, mix: index === 8 ? 22 : 0 },
    },
  ],
  ['amp-eq', { params: { lowCut: 55 + (index % 4) * 8, bass: varied(1.8, index, 0.28, -2, 5), mid: varied(0.5, index, 0.22, -3, 4), treble: 1 + (index % 5), presence: index % 3 } }],
  ['cabinet-ir', { params: { cabinetType: pick(['1x12', '2x12', 'openBack'], index), mic: pick(['dynamic', 'condenser', 'mixed'], index), highCut: 7600 + (index % 4) * 600 } }],
  ['modulation', { bypassed: index % 3 !== 2, params: { mode: 'chorus', rate: 0.45 + index * 0.06, depth: 18 + (index % 5) * 7, mix: 16 + (index % 4) * 6, stereoWidth: 36 + (index % 5) * 10 } }],
  ['delay', { bypassed: index % 4 === 0, params: { mode: pick(['digital', 'slapback', 'analog'], index), timeMs: 90 + (index % 6) * 58, feedback: 0.12 + (index % 5) * 0.04, mix: 8 + (index % 5) * 3, tone: 58 + (index % 5) * 5 } }],
  ['reverb', { params: { mode: pick(['room', 'plate', 'spring'], index), decay: 0.7 + (index % 6) * 0.28, preDelay: 8 + (index % 5) * 8, mix: 14 + (index % 5) * 3 } }],
];

const bassBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -54 + (index % 5) * 2, releaseMs: 130 } }],
  ['compressor', { params: { sustain: 52 + (index % 6) * 5, ratio: 4 + (index % 4), attack: 0.008, release: 0.28, mix: 78, level: 76 } }],
  ['drive', { bypassed: index % 4 === 0, params: { mode: pick(['overdrive', 'crunch', 'distortion'], index), drive: 14 + (index % 8) * 7, tone: 38 + (index % 6) * 5, level: 70, mix: 24 + (index % 5) * 10 } }],
  ['amp-eq', { params: { lowCut: 40 + (index % 3) * 8, bass: 3 + (index % 4), mid: -1 + (index % 6) * 0.8, midFreq: 320 + (index % 6) * 90, treble: -2 + (index % 5), presence: -1 + (index % 4), level: 76 } }],
  ['cabinet-ir', { params: { cabinetType: pick(['1x12', '2x12', '4x12'], index), mic: pick(['dynamic', 'ribbon', 'mixed'], index), lowCut: 45 + (index % 3) * 10, highCut: 4200 + (index % 5) * 600, mix: 88, level: 76 } }],
  ['modulation', { bypassed: index % 4 !== 1, params: { mode: 'chorus', rate: 0.35 + index * 0.04, depth: 22 + (index % 5) * 8, mix: 18 + (index % 4) * 5, stereoWidth: 46 } }],
  ['delay', { bypassed: index % 3 !== 2, params: { mode: pick(['analog', 'digital', 'tape'], index), timeMs: 260 + (index % 5) * 70, feedback: 0.16 + (index % 4) * 0.06, mix: 10 + (index % 4) * 5, tone: 42 } }],
  ['reverb', { params: { mode: pick(['room', 'plate'], index), decay: 0.55 + (index % 5) * 0.18, mix: 8 + (index % 4) * 3, highCut: 5200 } }],
];

const leadBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -48 + (index % 4) * 2, releaseMs: 120 } }],
  ['compressor', { params: { sustain: 48 + (index % 7) * 6, ratio: 3.5 + (index % 5), mix: 68 + (index % 3) * 8, level: 76 } }],
  ['drive', { params: { mode: pick(['overdrive', 'crunch', 'distortion', 'fuzz'], index), drive: 38 + (index % 8) * 7, tone: 48 + (index % 7) * 5, level: 70 + (index % 4) * 2, mix: 94, bias: -0.12 + (index % 7) * 0.04 } }],
  ['amp-eq', { params: { lowCut: 70, bass: 0 + (index % 4), mid: 1.5 + (index % 6) * 0.7, midFreq: 620 + (index % 6) * 100, midQ: 0.8 + (index % 4) * 0.2, treble: 1 + (index % 5), presence: 1 + (index % 5) } }],
  ['cabinet-ir', { params: { cabinetType: pick(['2x12', '4x12'], index), mic: pick(['dynamic', 'condenser', 'mixed'], index), highCut: 5600 + (index % 5) * 500 } }],
  ['modulation', { bypassed: index % 4 !== 3, params: { mode: pick(['chorus', 'phaser', 'vibrato'], index), rate: 0.4 + (index % 5) * 0.14, depth: 18 + (index % 6) * 6, mix: 14 + (index % 5) * 5 } }],
  ['delay', { params: { mode: pick(['analog', 'digital', 'tape', 'pingpong'], index), timeMs: 310 + (index % 6) * 58, feedback: 0.22 + (index % 5) * 0.07, mix: 18 + (index % 6) * 4, tone: 48 + (index % 6) * 5 } }],
  ['reverb', { params: { mode: pick(['plate', 'spring', 'hall'], index), decay: 1.1 + (index % 6) * 0.38, preDelay: 18 + (index % 6) * 8, mix: 16 + (index % 5) * 4 } }],
];

const crunchBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -50 + (index % 4) * 2, releaseMs: 110 } }],
  ['compressor', { params: { sustain: 34 + (index % 6) * 4, mix: 52 + (index % 5) * 6, level: 72 } }],
  ['drive', { params: { mode: 'crunch', drive: 36 + (index % 8) * 6, tone: 48 + (index % 7) * 5, level: 72, mix: 92 } }],
  ['amp-eq', { params: { lowCut: 70 + (index % 3) * 8, bass: 1 + (index % 5), mid: 1.5 + (index % 6) * 0.55, midFreq: 650 + (index % 5) * 95, treble: 1 + (index % 5), presence: index % 5 } }],
  ['cabinet-ir', { params: { cabinetType: pick(['1x12', '2x12', '4x12'], index), mic: pick(['dynamic', 'ribbon'], index), highCut: 5900 + (index % 5) * 520 } }],
  ['modulation', { bypassed: index % 5 !== 2, params: { mode: pick(['phaser', 'chorus'], index), rate: 0.55 + (index % 6) * 0.12, depth: 22 + (index % 5) * 6, mix: 15 + (index % 5) * 4 } }],
  ['delay', { params: { mode: pick(['slapback', 'analog', 'tape'], index), timeMs: 90 + (index % 7) * 45, feedback: 0.12 + (index % 5) * 0.04, mix: 8 + (index % 5) * 3, tone: 52 } }],
  ['reverb', { params: { mode: pick(['room', 'spring', 'plate'], index), decay: 0.75 + (index % 5) * 0.22, mix: 10 + (index % 5) * 3 } }],
];

const highGainBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -42 + (index % 5) * 2, releaseMs: 70 + (index % 5) * 15 } }],
  ['compressor', { params: { sustain: 22 + (index % 5) * 5, ratio: 3 + (index % 4), attack: 0.006, release: 0.18, mix: 44 + (index % 4) * 8, level: 70 } }],
  ['drive', { params: { mode: pick(['distortion', 'fuzz', 'crunch'], index), drive: 66 + (index % 7) * 5, tone: 52 + (index % 6) * 5, level: 64 + (index % 5) * 2, mix: 100, bias: -0.18 + (index % 6) * 0.06 } }],
  ['amp-eq', { params: { lowCut: 82 + (index % 4) * 6, bass: 3 + (index % 5), mid: -5 + (index % 6) * 1.1, midFreq: 520 + (index % 6) * 95, midQ: 1 + (index % 5) * 0.18, treble: 2 + (index % 5), presence: 3 + (index % 5) } }],
  ['cabinet-ir', { params: { cabinetType: '4x12', mic: pick(['dynamic', 'mixed', 'ribbon'], index), lowCut: 80 + (index % 4) * 8, highCut: 5200 + (index % 6) * 360 } }],
  ['modulation', { bypassed: index % 6 !== 4, params: { mode: pick(['phaser', 'flanger'], index), rate: 0.35 + (index % 6) * 0.12, depth: 18 + (index % 5) * 6, feedback: 0.18, mix: 12 + (index % 4) * 4 } }],
  ['delay', { params: { mode: pick(['digital', 'pingpong', 'analog'], index), timeMs: 330 + (index % 5) * 50, feedback: 0.16 + (index % 5) * 0.05, mix: 8 + (index % 5) * 4, tone: 50 } }],
  ['reverb', { params: { mode: pick(['room', 'plate'], index), decay: 0.5 + (index % 5) * 0.18, mix: 7 + (index % 4) * 2 } }],
];

const ambientBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -56 + (index % 4) * 2, releaseMs: 220 } }],
  ['compressor', { params: { sustain: 46 + (index % 7) * 4, mix: 70, level: 74 } }],
  ['drive', { bypassed: index % 4 !== 3, params: { mode: 'overdrive', drive: 10 + (index % 4) * 6, tone: 52, level: 72, mix: 24 } }],
  ['amp-eq', { params: { lowCut: 70, bass: -1 + (index % 5), mid: -2 + (index % 5) * 0.7, treble: 2 + (index % 4), presence: 2 + (index % 5) } }],
  ['cabinet-ir', { params: { cabinetType: pick(['openBack', '2x12', '1x12'], index), mic: pick(['condenser', 'ribbon', 'mixed'], index), highCut: 7600 + (index % 6) * 500 } }],
  ['modulation', { bypassed: false, params: { mode: pick(['chorus', 'phaser', 'vibrato', 'flanger'], index), rate: 0.08 + (index % 6) * 0.12, depth: 36 + (index % 6) * 8, feedback: 0.1 + (index % 5) * 0.04, mix: 28 + (index % 6) * 5, stereoWidth: 70 + (index % 4) * 7 } }],
  ['delay', { params: { mode: pick(['tape', 'pingpong', 'analog', 'digital'], index), timeMs: 520 + (index % 7) * 95, feedback: 0.36 + (index % 6) * 0.07, mix: 28 + (index % 6) * 5, tone: 42 + (index % 6) * 4, flutter: 18 + (index % 7) * 9, sync: index % 2 === 0, bpm: 68 + (index % 5) * 8, division: pick(['1/4', '1/8', 'dotted1/8'], index) } }],
  ['reverb', { params: { mode: pick(['ambient', 'hall', 'plate'], index), decay: 3.2 + (index % 8) * 0.72, preDelay: 30 + (index % 6) * 15, lowCut: 120, highCut: 6200 + (index % 5) * 600, mix: 34 + (index % 7) * 4, level: 74 } }],
];

const modulationBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['drive', { bypassed: index % 5 !== 4, params: { mode: 'overdrive', drive: 12 + (index % 6) * 5, tone: 50, level: 72, mix: 32 } }],
  ['amp-eq', { params: { bass: 0 + (index % 4), mid: -1 + (index % 5) * 0.5, treble: 1 + (index % 5), presence: 1 + (index % 4) } }],
  ['modulation', { bypassed: false, params: { mode: pick(['chorus', 'flanger', 'phaser', 'tremolo', 'vibrato'], index), rate: 0.15 + (index % 8) * 0.48, depth: 35 + (index % 8) * 7, feedback: 0.08 + (index % 7) * 0.08, mix: 28 + (index % 7) * 6, tone: 50 + (index % 6) * 6, stereoWidth: 50 + (index % 6) * 8, sync: index % 3 === 0, bpm: 90 + (index % 6) * 10, division: pick(['1/4', '1/8', 'dotted1/8', '1/16'], index) } }],
  ['delay', { params: { mode: pick(['digital', 'analog'], index), timeMs: 220 + (index % 5) * 60, feedback: 0.18 + (index % 4) * 0.05, mix: 12 + (index % 5) * 4 } }],
  ['reverb', { params: { mode: pick(['room', 'plate', 'hall'], index), decay: 1.0 + (index % 6) * 0.3, mix: 14 + (index % 5) * 3 } }],
];

const fxBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -50 + (index % 6) * 3, releaseMs: 80 + (index % 5) * 35 } }],
  ['compressor', { params: { sustain: 40 + (index % 8) * 5, ratio: 5 + (index % 6), mix: 62, level: 72 } }],
  ['drive', { bypassed: index % 3 === 1, params: { mode: pick(['fuzz', 'distortion', 'overdrive'], index), drive: 28 + (index % 9) * 8, tone: 36 + (index % 8) * 7, level: 66, mix: 54 + (index % 6) * 8, bias: -0.45 + (index % 10) * 0.1 } }],
  ['amp-eq', { params: { lowCut: 70 + (index % 6) * 12, bass: -4 + (index % 9), mid: -6 + (index % 10) * 1.2, midFreq: 300 + (index % 8) * 130, midQ: 0.6 + (index % 7) * 0.35, treble: -2 + (index % 9), presence: -2 + (index % 8) } }],
  ['cabinet-ir', { params: { cabinetType: pick(['1x12', '2x12', '4x12', 'openBack'], index), mic: pick(['dynamic', 'ribbon', 'condenser', 'mixed'], index), lowCut: 70 + (index % 5) * 18, highCut: 3600 + (index % 8) * 800, mix: 82 } }],
  ['modulation', { bypassed: false, params: { mode: pick(['flanger', 'phaser', 'tremolo', 'vibrato', 'chorus'], index), rate: 0.35 + (index % 10) * 1.25, depth: 48 + (index % 7) * 7, feedback: 0.16 + (index % 8) * 0.08, mix: 34 + (index % 8) * 6, tone: 46, stereoWidth: 70 } }],
  ['delay', { params: { mode: pick(['tape', 'pingpong', 'digital', 'analog'], index), timeMs: 120 + (index % 9) * 160, feedback: 0.24 + (index % 8) * 0.08, mix: 22 + (index % 8) * 6, tone: 34 + (index % 8) * 6, flutter: 20 + (index % 8) * 9 } }],
  ['reverb', { params: { mode: pick(['ambient', 'spring', 'plate', 'hall'], index), decay: 1.2 + (index % 9) * 0.75, preDelay: 10 + (index % 7) * 18, mix: 22 + (index % 8) * 5 } }],
];

const experimentalBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['noise-gate', { params: { thresholdDb: -46 + (index % 8) * 2, releaseMs: 35 + (index % 8) * 28 } }],
  ['compressor', { params: { sustain: 58 + (index % 7) * 6, ratio: 8 + (index % 8), attack: 0.002 + (index % 4) * 0.004, release: 0.12 + (index % 6) * 0.08, mix: 70, level: 70 } }],
  ['drive', { params: { mode: pick(['fuzz', 'distortion', 'crunch', 'overdrive'], index), drive: 50 + (index % 9) * 5, tone: 24 + (index % 10) * 7, level: 58 + (index % 7) * 3, mix: 76 + (index % 5) * 6, bias: -0.8 + (index % 12) * 0.15 } }],
  ['amp-eq', { params: { lowCut: 40 + (index % 8) * 18, bass: -8 + (index % 12) * 1.7, mid: -9 + (index % 12) * 1.6, midFreq: 250 + (index % 10) * 125, midQ: 0.4 + (index % 8) * 0.4, treble: -8 + (index % 12) * 1.6, presence: -5 + (index % 11) * 1.4 } }],
  ['cabinet-ir', { params: { cabinetType: pick(['custom', 'openBack', '4x12', '1x12'], index), mic: pick(['mixed', 'ribbon', 'condenser', 'dynamic'], index), lowCut: 50 + (index % 8) * 16, highCut: 3000 + (index % 9) * 900, mix: 70 + (index % 5) * 6 } }],
  ['modulation', { bypassed: false, params: { mode: pick(['vibrato', 'flanger', 'phaser', 'tremolo', 'chorus'], index), rate: 0.05 + (index % 11) * 1.7, depth: 55 + (index % 7) * 6, feedback: 0.2 + (index % 8) * 0.08, mix: 45 + (index % 8) * 5, tone: 42, stereoWidth: 82 } }],
  ['delay', { params: { mode: pick(['tape', 'pingpong', 'digital', 'analog'], index), timeMs: 40 + (index % 11) * 175, feedback: 0.28 + (index % 8) * 0.08, mix: 26 + (index % 9) * 5, tone: 28 + (index % 9) * 7, flutter: 38 + (index % 7) * 8, sync: index % 4 === 0, division: pick(['1/4', '1/8', 'dotted1/8', '1/16'], index) } }],
  ['reverb', { params: { mode: pick(['ambient', 'spring', 'hall', 'plate'], index), decay: 2 + (index % 10) * 0.8, preDelay: (index % 8) * 24, lowCut: 60 + (index % 8) * 30, highCut: 2400 + (index % 10) * 850, mix: 28 + (index % 9) * 5 } }],
];

const PRESET_BLUEPRINTS: PresetBlueprint[] = [
  {
    category: 'Clean',
    names: ['Studio Glass Clean', 'Warm Combo Clean', 'Jazz Neck Clean', 'Country Snap Clean', 'Funk Chime Clean', 'Crystal Chorus Clean', 'Nashville Plate Clean', 'Fingerstyle Air', 'Clean Boost Edge', 'Direct Practice Clean', 'Boutique Sparkle', 'Midnight Clean'],
    tags: ['clean', 'practice', 'amp'],
    tempoBase: 96,
    masterVolume: 0.34,
    makePatches: cleanBlueprint,
    describe: (name) => `${name} keeps the amp clear with controlled compression and tasteful space.`,
  },
  {
    category: 'Bass',
    names: ['Round Bass DI', 'Vintage Bass Cab', 'Pick Bass Grind', 'Sub Foundation', 'Bright Finger Bass', 'Bass Chorus Wide', 'Motown Thump', 'Modern Tight Bass', 'Dub Delay Bass', 'Fretless Bloom', 'Tube Bass Drive', 'Studio Bass Comp'],
    tags: ['bass', 'low end', 'direct'],
    tempoBase: 88,
    masterVolume: 0.36,
    makePatches: bassBlueprint,
    describe: (name) => `${name} is voiced for low-end focus with a controlled cabinet top end.`,
  },
  {
    category: 'Lead',
    names: ['Blues Velvet Lead', 'Singing Sustain Lead', 'Classic Delay Lead', 'Liquid Fusion Lead', 'Arena Solo Lead', 'Neck Pickup Lead', 'Smooth Legato Lead', 'Vintage Echo Lead', 'Octave Fuzz Lead', 'Texas Bite Lead', 'Glass Slide Lead', 'Modern Lead Cut'],
    tags: ['lead', 'solo', 'delay'],
    tempoBase: 104,
    masterVolume: 0.38,
    makePatches: leadBlueprint,
    describe: (name) => `${name} gives single notes more sustain, focus, and delay depth.`,
  },
  {
    category: 'Crunch',
    names: ['Classic Crunch Stack', 'Brit Rhythm Crunch', 'Open Chord Crunch', 'Garage Combo Crunch', 'Roots Rock Crunch', 'Edge Breakup Crunch', 'Indie Rhythm Crunch', 'Plexi Mid Push', 'Tweed Hair Crunch', 'Alt Rock Crunch', 'Power Pop Crunch', 'Bluesbreaker Bite'],
    tags: ['crunch', 'rhythm', 'rock'],
    tempoBase: 116,
    masterVolume: 0.37,
    makePatches: crunchBlueprint,
    describe: (name) => `${name} balances picking dynamics with amp-like breakup.`,
  },
  {
    category: 'High Gain',
    names: ['Modern Tight Gain', 'Scooped Metal Wall', 'Djent Gate Stack', 'High Gain Lead', 'Drop Tune Rhythm', 'Thrash Cut', 'Doom Saturation', 'Prog Metal Focus', 'Hardcore Bite', 'Liquid Shred Gain', 'Dark Mesa Style', 'Bright 4x12 Fire'],
    tags: ['metal', 'gain', 'gate'],
    tempoBase: 132,
    masterVolume: 0.34,
    makePatches: highGainBlueprint,
    describe: (name) => `${name} uses tighter gate and cabinet filtering for heavy tones.`,
  },
  {
    category: 'Ambient',
    names: ['Shimmerless Cloud', 'Tape Halo Clean', 'Dotted Eighth Sky', 'Slow Motion Pad', 'Deep Hall Swell', 'Stereo Wash Lead', 'Dream Plate Echo', 'Ambient Trem Bed', 'Cathedral Clean', 'Reverse-Like Bloom', 'Soft Focus Loop', 'Midnight Atmosphere'],
    tags: ['ambient', 'delay', 'reverb'],
    tempoBase: 72,
    masterVolume: 0.33,
    makePatches: ambientBlueprint,
    describe: (name) => `${name} stretches the guitar into wide delay and reverb textures.`,
  },
  {
    category: 'Modulation',
    names: ['Wide Chorus Clean', 'Jet Flanger Rhythm', 'Four Stage Phaser', 'Brown Trem Pulse', 'Deep Vibrato Lead', 'Rotary-Like Sweep', 'Slow Chorus Pad', 'Fast Trem Chop', 'Liquid Phaser Lead', 'Tape Wobble Mod', 'Stereo Motion Clean', 'Subtle Ensemble'],
    tags: ['modulation', 'chorus', 'movement'],
    tempoBase: 100,
    masterVolume: 0.35,
    makePatches: modulationBlueprint,
    describe: (name) => `${name} puts the modulation block forward while preserving core tone.`,
  },
  {
    category: 'FX',
    names: ['Robot Gate Pulse', 'Filter Telephone', 'Lo-Fi Cabinet FX', 'Ping Pong Warp', 'Spring Crash Echo', 'Trem Delay Chop', 'Fuzz Octave Texture', 'Ghost Slap Machine', 'Ringless Sci-Fi', 'Dub Feedback Throw', 'Broken Tape Deck', 'Glitch Rhythm Bed'],
    tags: ['fx', 'creative', 'sound design'],
    tempoBase: 110,
    masterVolume: 0.32,
    makePatches: fxBlueprint,
    describe: (name) => `${name} is a creative effect patch for transitions, layers, and experiments.`,
  },
  {
    category: 'Experimental',
    names: ['Fuzz Experiment', 'Voltage Starve', 'Sub Oscillation Dirt', 'Alien Vibrato Wash', 'Broken Radio Lead', 'Granular-Like Echo', 'Deep Reese Guitar', 'Pitch Drift Texture', 'Square Solo Voice', 'Noise Bloom Pad', 'Dark Wavetable Bite', 'Acid Ladder Bite'],
    tags: ['experimental', 'fuzz', 'texture'],
    tempoBase: 90,
    masterVolume: 0.31,
    makePatches: experimentalBlueprint,
    describe: (name) => `${name} pushes the available effects into unusual performance textures.`,
  },
];

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const DEFAULT_PRESETS: PedalboardPreset[] = PRESET_BLUEPRINTS.flatMap((blueprint) =>
  blueprint.names.map((name, index) =>
    buildPreset(
      `factory-${slug(blueprint.category)}-${String(index + 1).padStart(2, '0')}-${slug(name)}`,
      name,
      makeSnapshot(blueprint.masterVolume, blueprint.tempoBase + index * 2, blueprint.makePatches(index)),
      FACTORY_CREATED_AT,
      FACTORY_CREATED_AT,
      {
        category: blueprint.category,
        origin: 'factory',
        description: blueprint.describe(name, index),
        tags: [...blueprint.tags, slug(name)],
      },
    ),
  ),
);

const FACTORY_IDS = new Set(DEFAULT_PRESETS.map((preset) => preset.id));

export const getFactoryPresetCategories = () => [...FACTORY_CATEGORIES];

const clonePreset = (preset: PedalboardPreset): PedalboardPreset => ({
  ...preset,
  pedals: clonePedals(preset.pedals),
  tags: [...preset.tags],
});

const writePresets = (presets: PedalboardPreset[]) => {
  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify({ version: 2, presets }));
};

const readPresets = () => {
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    const presets = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && 'presets' in parsed && Array.isArray(parsed.presets)
        ? parsed.presets
        : null;

    if (!presets) {
      return null;
    }

    return presets.map((preset) => normalizePreset(preset, 'user')).filter(Boolean) as PedalboardPreset[];
  } catch {
    return null;
  }
};

const inferCategory = (name: string) => {
  const lower = name.toLowerCase();

  if (lower.includes('bass')) return 'Bass';
  if (lower.includes('lead') || lower.includes('solo')) return 'Lead';
  if (lower.includes('gain') || lower.includes('metal')) return 'High Gain';
  if (lower.includes('ambient') || lower.includes('delay') || lower.includes('cloud')) return 'Ambient';
  if (lower.includes('chorus') || lower.includes('phaser') || lower.includes('trem')) return 'Modulation';
  if (lower.includes('fuzz') || lower.includes('experiment')) return 'Experimental';
  if (lower.includes('crunch') || lower.includes('rock')) return 'Crunch';
  return 'Clean';
};

const normalizePreset = (value: unknown, fallbackOrigin: PresetOrigin): PedalboardPreset | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PedalboardPreset>;
  if (!candidate.name || !Array.isArray(candidate.pedals)) {
    return null;
  }

  const id = typeof candidate.id === 'string' ? candidate.id : createId('imported');
  const fallbackCategory = id.startsWith('factory-') || LEGACY_FACTORY_IDS.has(id) ? inferCategory(candidate.name) : 'User Presets';
  const fallbackForOrigin = id.startsWith('factory-') || LEGACY_FACTORY_IDS.has(id) ? 'factory' : fallbackOrigin;

  return buildPreset(
    id,
    candidate.name,
    {
      pedals: normalizePedals(candidate.pedals),
      masterVolume: typeof candidate.masterVolume === 'number' ? candidate.masterVolume : 0.35,
      tempoBpm: typeof candidate.tempoBpm === 'number' ? candidate.tempoBpm : 120,
    },
    typeof candidate.createdAt === 'string' ? candidate.createdAt : nowIso(),
    typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso(),
    {
      category: sanitizeCategory(candidate.category, fallbackCategory),
      origin: sanitizeOrigin(candidate.origin, fallbackForOrigin),
      description: typeof candidate.description === 'string' ? candidate.description : '',
      tags: sanitizeTags(candidate.tags),
    },
  );
};

const mergeWithFactoryLibrary = (storedPresets: PedalboardPreset[] | null) => {
  const storedById = new Map((storedPresets ?? []).map((preset) => [preset.id, preset]));
  const factoryPresets = DEFAULT_PRESETS.map((factoryPreset) => clonePreset(storedById.get(factoryPreset.id) ?? factoryPreset));
  const userPresets = (storedPresets ?? []).filter((preset) => !FACTORY_IDS.has(preset.id) && !LEGACY_FACTORY_IDS.has(preset.id));
  return [...factoryPresets, ...userPresets.map(clonePreset)];
};

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: DEFAULT_PRESETS.map(clonePreset),
  activePresetId: DEFAULT_PRESETS[0]?.id ?? null,
  currentPresetName: DEFAULT_PRESETS[0]?.name ?? 'Init Patch',
  hydratePresets: () => {
    const presets = mergeWithFactoryLibrary(readPresets());
    writePresets(presets);
    set((state) => {
      const activePreset = presets.find((preset) => preset.id === state.activePresetId) ?? presets[0] ?? null;
      return {
        presets,
        activePresetId: activePreset?.id ?? null,
        currentPresetName: activePreset?.name ?? 'Init Patch',
      };
    });
  },
  savePreset: (name, snapshot) => {
    const preset = buildPreset(createId(), name, snapshot, nowIso(), nowIso(), {
      category: 'User Presets',
      origin: 'user',
      description: 'Saved from the current pedalboard state.',
      tags: ['user'],
    });
    const presets = [preset, ...get().presets];
    writePresets(presets);
    set({ presets, activePresetId: preset.id, currentPresetName: preset.name });
    return clonePreset(preset);
  },
  updateActivePreset: (snapshot) => {
    const activePresetId = get().activePresetId;
    if (!activePresetId) {
      return null;
    }

    const sourcePreset = get().presets.find((preset) => preset.id === activePresetId);
    if (!sourcePreset) {
      return null;
    }

    const updatedPreset = buildPreset(sourcePreset.id, sourcePreset.name, snapshot, sourcePreset.createdAt, nowIso(), {
      category: sourcePreset.category,
      origin: sourcePreset.origin,
      description: sourcePreset.description,
      tags: sourcePreset.tags,
    });
    const presets = get().presets.map((preset) => (preset.id === activePresetId ? updatedPreset : preset));
    writePresets(presets);
    set({ presets, currentPresetName: updatedPreset.name });
    return clonePreset(updatedPreset);
  },
  loadPreset: (id) => {
    const preset = get().presets.find((candidate) => candidate.id === id) ?? null;
    if (!preset) {
      return null;
    }

    set({ activePresetId: preset.id, currentPresetName: preset.name });
    return clonePreset(preset);
  },
  renamePreset: (id, name) => {
    const presets = get().presets.map((preset) =>
      preset.id === id ? { ...preset, name: sanitizeName(name, preset.name), origin: preset.origin === 'factory' ? 'user' : preset.origin, category: preset.origin === 'factory' ? 'User Presets' : preset.category, updatedAt: nowIso() } : preset,
    );
    const activePreset = presets.find((preset) => preset.id === get().activePresetId);
    writePresets(presets);
    set({ presets, currentPresetName: activePreset?.name ?? get().currentPresetName });
  },
  deletePreset: (id) => {
    const source = get().presets.find((preset) => preset.id === id);
    if (source?.origin === 'factory') {
      return;
    }

    const presets = get().presets.filter((preset) => preset.id !== id);
    const activePreset = get().activePresetId === id ? presets[0] ?? null : presets.find((preset) => preset.id === get().activePresetId);
    writePresets(presets);
    set({
      presets,
      activePresetId: activePreset?.id ?? null,
      currentPresetName: activePreset?.name ?? 'Init Patch',
    });
  },
  duplicatePreset: (id) => {
    const source = get().presets.find((preset) => preset.id === id);
    if (!source) {
      return null;
    }

    const duplicated = buildPreset(createId('copy'), `${source.name} Copy`, source, nowIso(), nowIso(), {
      category: 'User Presets',
      origin: 'user',
      description: source.description || `Duplicate of ${source.name}.`,
      tags: [...source.tags, 'copy'],
    });
    const presets = [duplicated, ...get().presets];
    writePresets(presets);
    set({ presets, activePresetId: duplicated.id, currentPresetName: duplicated.name });
    return clonePreset(duplicated);
  },
  importPresets: (json) => {
    const parsed = JSON.parse(json) as unknown;
    const values = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed && 'presets' in parsed && Array.isArray(parsed.presets)
        ? parsed.presets
        : [parsed];
    const imported = values.map((preset) => normalizePreset(preset, 'imported')).filter(Boolean) as PedalboardPreset[];
    const existingIds = new Set(get().presets.map((preset) => preset.id));
    const uniqueImported = imported.map((preset) =>
      existingIds.has(preset.id)
        ? { ...preset, id: createId('imported'), name: `${preset.name} Imported`, origin: 'imported' as const }
        : { ...preset, origin: preset.origin === 'factory' ? ('imported' as const) : preset.origin },
    );
    const presets = [...uniqueImported, ...get().presets];
    writePresets(presets);
    set({
      presets,
      activePresetId: uniqueImported[0]?.id ?? get().activePresetId,
      currentPresetName: uniqueImported[0]?.name ?? get().currentPresetName,
    });
    return { imported: uniqueImported.length, skipped: values.length - uniqueImported.length };
  },
  exportPresets: () => JSON.stringify({ version: 2, presets: get().presets.map(clonePreset) }, null, 2),
}));
