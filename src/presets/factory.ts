// The 108 factory presets, generated from blueprints. Pure: nothing runs until buildFactoryPresets() is called.
import { createDefaultPedals, type Pedal } from '../audio/types';
import { factoryTrimDb } from '../store/factoryCalibration';
import { buildPreset, clamp } from './build';
import type { PedalboardPreset } from './types';

export const FACTORY_CREATED_AT = '2026-01-01T00:00:00.000Z';
export const FACTORY_CATEGORIES = ['Clean', 'Bass', 'Lead', 'Crunch', 'High Gain', 'Ambient', 'Modulation', 'FX', 'Experimental'];

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

  return { pedals, masterVolume, outputTrimDb: 0, tempoBpm };
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
  ['delay', { params: { mode: pick(['tape', 'pingpong', 'analog', 'digital'], index), timeMs: 520 + (index % 7) * 95, feedback: 0.36 + (index % 6) * 0.07, mix: 28 + (index % 6) * 5, tone: 42 + (index % 6) * 4, flutter: 18 + (index % 7) * 9, sync: index % 2 === 0, division: pick(['1/4', '1/8', 'dotted1/8'], index) } }],
  ['reverb', { params: { mode: pick(['ambient', 'hall', 'plate'], index), decay: 3.2 + (index % 8) * 0.72, preDelay: 30 + (index % 6) * 15, lowCut: 120, highCut: 6200 + (index % 5) * 600, mix: 34 + (index % 7) * 4, level: 74 } }],
];

const modulationBlueprint = (index: number): Array<[string, Partial<Pedal>]> => [
  ['drive', { bypassed: index % 5 !== 4, params: { mode: 'overdrive', drive: 12 + (index % 6) * 5, tone: 50, level: 72, mix: 32 } }],
  ['amp-eq', { params: { bass: 0 + (index % 4), mid: -1 + (index % 5) * 0.5, treble: 1 + (index % 5), presence: 1 + (index % 4) } }],
  ['modulation', { bypassed: false, params: { mode: pick(['chorus', 'flanger', 'phaser', 'tremolo', 'vibrato'], index), rate: 0.15 + (index % 8) * 0.48, depth: 35 + (index % 8) * 7, feedback: 0.08 + (index % 7) * 0.08, mix: 28 + (index % 7) * 6, tone: 50 + (index % 6) * 6, stereoWidth: 50 + (index % 6) * 8, sync: index % 3 === 0, division: pick(['1/4', '1/8', 'dotted1/8', '1/16'], index) } }],
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
  ['compressor', { params: { sustain: 38 + (index % 7) * 4, ratio: 3.5 + (index % 8) * 0.5, attack: 0.002 + (index % 4) * 0.004, release: 0.12 + (index % 6) * 0.08, mix: 60, level: 70 } }],
  ['drive', { params: { mode: pick(['fuzz', 'distortion', 'crunch', 'overdrive'], index), drive: 50 + (index % 9) * 5, tone: 24 + (index % 10) * 7, level: 58 + (index % 7) * 3, mix: 76 + (index % 5) * 6, bias: -0.22 + (index % 12) * 0.04 } }],
  ['amp-eq', { params: { lowCut: 40 + (index % 8) * 18, bass: -3 + (index % 12) * 0.55, mid: -3 + (index % 12) * 0.55, midFreq: 250 + (index % 10) * 125, midQ: 0.4 + (index % 8) * 0.4, treble: -3 + (index % 12) * 0.55, presence: -2 + (index % 11) * 0.5 } }],
  ['cabinet-ir', { params: { cabinetType: pick(['2x12', 'openBack', '4x12', '1x12'], index), mic: pick(['mixed', 'ribbon', 'condenser', 'dynamic'], index), lowCut: 50 + (index % 8) * 16, highCut: 3000 + (index % 9) * 900, mix: 70 + (index % 5) * 6 } }],
  ['modulation', { bypassed: false, params: { mode: pick(['vibrato', 'flanger', 'phaser', 'tremolo', 'chorus'], index), rate: 0.05 + (index % 11) * 1.7, depth: 55 + (index % 7) * 6, feedback: 0.2 + (index % 8) * 0.08, mix: 25 + (index % 8) * 4, tone: 42, stereoWidth: 82 } }],
  ['delay', { params: { mode: pick(['tape', 'pingpong', 'digital', 'analog'], index), timeMs: 40 + (index % 11) * 175, feedback: 0.28 + (index % 8) * 0.08, mix: 20 + (index % 9) * 3, tone: 28 + (index % 9) * 7, flutter: 38 + (index % 7) * 8, sync: index % 4 === 0, division: pick(['1/4', '1/8', 'dotted1/8', '1/16'], index) } }],
  ['reverb', { params: { mode: pick(['ambient', 'spring', 'hall', 'plate'], index), decay: 2 + (index % 10) * 0.8, preDelay: (index % 8) * 24, lowCut: 60 + (index % 8) * 30, highCut: 2400 + (index % 10) * 850, mix: 18 + (index % 9) * 3 } }],
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
    names: ['Blues Velvet Lead', 'Singing Sustain Lead', 'Classic Delay Lead', 'Liquid Fusion Lead', 'Arena Solo Lead', 'Neck Pickup Lead', 'Smooth Legato Lead', 'Vintage Echo Lead', 'Driven Fuzz Lead', 'Texas Bite Lead', 'Glass Slide Lead', 'Modern Lead Cut'],
    tags: ['lead', 'solo', 'delay'],
    tempoBase: 104,
    masterVolume: 0.38,
    makePatches: leadBlueprint,
    describe: (name) => `${name} gives single notes more sustain, focus, and delay depth.`,
  },
  {
    category: 'Crunch',
    names: ['Classic Crunch Stack', 'Brit Rhythm Crunch', 'Open Chord Crunch', 'Garage Combo Crunch', 'Roots Rock Crunch', 'Edge Breakup Crunch', 'Indie Rhythm Crunch', 'Classic Mid Push', 'Warm Hair Crunch', 'Alt Rock Crunch', 'Power Pop Crunch', 'Blues Crunch Bite'],
    tags: ['crunch', 'rhythm', 'rock'],
    tempoBase: 116,
    masterVolume: 0.37,
    makePatches: crunchBlueprint,
    describe: (name) => `${name} balances picking dynamics with amp-like breakup.`,
  },
  {
    category: 'High Gain',
    names: ['Modern Tight Gain', 'Scooped Metal Wall', 'Djent Gate Stack', 'High Gain Lead', 'Drop Tune Rhythm', 'Thrash Cut', 'Doom Saturation', 'Prog Metal Focus', 'Hardcore Bite', 'Liquid Shred Gain', 'Dark High Gain', 'Bright 4x12 Fire'],
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
    names: ['Robot Gate Pulse', 'Filter Telephone', 'Lo-Fi Cabinet FX', 'Ping Pong Warp', 'Spring Crash Echo', 'Trem Delay Chop', 'Fuzz Texture', 'Ghost Slap Machine', 'Ringless Sci-Fi', 'Dub Feedback Throw', 'Broken Tape Deck', 'Glitch Rhythm Bed'],
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

// Names describe actual enabled effects rather than suggesting unavailable features.
const describeFactoryEffects = (pedals: Pedal[]) => {
  const activeMode = (type: Pedal['type']) => {
    const pedal = pedals.find((item) => item.type === type);
    if (!pedal || !pedal.enabled || pedal.bypassed || Number(pedal.params.mix) === 0) return null;
    const mode = pedal.params.mode;
    return typeof mode === 'string' ? mode : null;
  };
  const drive = activeMode('drive');
  const mod = activeMode('modulation');
  const delay = activeMode('delay');
  const reverb = activeMode('reverb');
  const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const sound = drive ? title(drive) : 'Clean';
  const additions = [mod && `${title(mod)} mod`, delay && `${title(delay)} delay`, reverb && `${title(reverb)} reverb`].filter(Boolean) as string[];
  return { name: [sound, ...additions.slice(0, 2)].join(' / '), description: [sound, ...additions].join(' · ') };
};

const createFactoryPresets = (): PedalboardPreset[] => PRESET_BLUEPRINTS.flatMap((blueprint) =>
  blueprint.names.map((legacyName, index) => {
    const snapshot = makeSnapshot(blueprint.masterVolume, blueprint.tempoBase + index * 2, blueprint.makePatches(index));
    snapshot.outputTrimDb = factoryTrimDb(blueprint.category, index);
    const effects = describeFactoryEffects(snapshot.pedals);
    return buildPreset(
      // Keep the previous ID stable so saved sessions and references still resolve.
      `factory-${slug(blueprint.category)}-${String(index + 1).padStart(2, '0')}-${slug(legacyName)}`,
      `${blueprint.category} ${String(index + 1).padStart(2, '0')} · ${effects.name}`,
      snapshot,
      FACTORY_CREATED_AT,
      FACTORY_CREATED_AT,
      {
        category: blueprint.category,
        origin: 'factory',
        description: effects.description,
        tags: [...blueprint.tags, slug(legacyName)],
      },
    );
  }),
);


let cache: { presets: PedalboardPreset[]; ids: Set<string> } | null = null;
const factoryCache = () => {
  if (!cache) {
    const presets = createFactoryPresets();
    cache = { presets, ids: new Set(presets.map((preset) => preset.id)) };
  }
  return cache;
};

/** Built once and cached; callers must clone before changing anything. */
export const buildFactoryPresets = (): readonly PedalboardPreset[] => factoryCache().presets;
export const factoryIds = (): ReadonlySet<string> => factoryCache().ids;
export const getFactoryPresetCategories = () => [...FACTORY_CATEGORIES];
