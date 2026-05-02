import { create } from 'zustand';
import { Pedal, PedalParamValue, createDefaultPedals, normalizePedalParams, normalizePedals } from '../audio/types';

export const PRESET_STORAGE_KEY = 'web-guitar-pedalboard-presets';

export type PedalboardPreset = {
  id: string;
  name: string;
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

const clonePedals = (pedals: Pedal[]) =>
  normalizePedals(pedals);

const createId = (prefix = 'preset') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nowIso = () => new Date().toISOString();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeName = (name: string, fallback = 'Untitled Preset') => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : fallback;
};

const buildPreset = (
  id: string,
  name: string,
  snapshot: PresetSnapshot,
  createdAt = nowIso(),
  updatedAt = createdAt,
): PedalboardPreset => ({
  id,
  name: sanitizeName(name),
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

const DEFAULT_PRESETS: PedalboardPreset[] = [
  buildPreset(
    'default-clean-practice',
    'Clean Practice',
    makeSnapshot(0.32, 100, [
      ['drive', { bypassed: true, params: { mix: 0 } }],
      ['delay', { params: { mode: 'digital', timeMs: 280, feedback: 0.18, mix: 14, tone: 72 } }],
      ['reverb', { params: { mode: 'room', decay: 0.8, preDelay: 12, mix: 18 } }],
    ]),
    '2026-01-01T00:00:00.000Z',
  ),
  buildPreset(
    'default-blues-lead',
    'Blues Lead',
    makeSnapshot(0.38, 92, [
      ['compressor', { params: { sustain: 54, mix: 72, level: 76 } }],
      ['drive', { params: { mode: 'overdrive', drive: 42, tone: 58, level: 76, mix: 92, bias: 0.12 } }],
      ['amp-eq', { params: { bass: 2, mid: 3, midFreq: 720, treble: 1, presence: 2 } }],
      ['delay', { params: { mode: 'analog', timeMs: 360, feedback: 0.26, mix: 18, tone: 48 } }],
      ['reverb', { params: { mode: 'spring', decay: 1.7, mix: 22 } }],
    ]),
    '2026-01-01T00:00:00.000Z',
  ),
  buildPreset(
    'default-classic-rock',
    'Classic Rock',
    makeSnapshot(0.4, 118, [
      ['drive', { params: { mode: 'crunch', drive: 58, tone: 64, level: 72, mix: 100 } }],
      ['amp-eq', { params: { bass: 2, mid: 3.5, midFreq: 820, treble: 2.5, presence: 2 } }],
      ['cabinet-ir', { params: { cabinetType: '2x12', mic: 'dynamic', highCut: 6800 } }],
      ['delay', { params: { mode: 'slapback', timeMs: 115, feedback: 0.14, mix: 12 } }],
      ['reverb', { params: { mode: 'plate', decay: 1.6, mix: 16 } }],
    ]),
    '2026-01-01T00:00:00.000Z',
  ),
  buildPreset(
    'default-high-gain',
    'High Gain',
    makeSnapshot(0.35, 132, [
      ['noise-gate', { params: { thresholdDb: -42, releaseMs: 120 } }],
      ['compressor', { params: { sustain: 30, mix: 55, level: 70 } }],
      ['drive', { params: { mode: 'distortion', drive: 78, tone: 66, level: 68, mix: 100 } }],
      ['amp-eq', { params: { bass: 5, mid: -4.5, midFreq: 650, midQ: 1.35, treble: 4, presence: 5 } }],
      ['cabinet-ir', { params: { cabinetType: '4x12', mic: 'mixed', lowCut: 95, highCut: 6200 } }],
      ['delay', { params: { mode: 'digital', timeMs: 430, feedback: 0.2, mix: 10 } }],
      ['reverb', { params: { mode: 'room', decay: 0.7, mix: 10 } }],
    ]),
    '2026-01-01T00:00:00.000Z',
  ),
  buildPreset(
    'default-ambient-delay',
    'Ambient Delay',
    makeSnapshot(0.34, 72, [
      ['drive', { bypassed: true }],
      ['amp-eq', { params: { bass: 1, mid: -1, treble: 2, presence: 3 } }],
      ['delay', { params: { mode: 'tape', timeMs: 640, feedback: 0.58, mix: 42, tone: 54, flutter: 38, sync: true, bpm: 72, division: 'dotted1/8' } }],
      ['reverb', { params: { mode: 'ambient', decay: 7.2, preDelay: 64, highCut: 8600, mix: 48, level: 76 } }],
    ]),
    '2026-01-01T00:00:00.000Z',
  ),
  buildPreset(
    'default-fuzz-experiment',
    'Fuzz Experiment',
    makeSnapshot(0.33, 104, [
      ['compressor', { params: { sustain: 68, mix: 82, level: 74 } }],
      ['drive', { params: { mode: 'fuzz', drive: 88, tone: 50, level: 66, mix: 100, bias: 0.2 } }],
      ['amp-eq', { params: { lowCut: 90, bass: 3, mid: -2, midFreq: 760, treble: 4, presence: 5 } }],
      ['delay', { params: { mode: 'pingpong', timeMs: 390, feedback: 0.44, mix: 32, tone: 60 } }],
      ['reverb', { params: { mode: 'plate', decay: 2.6, mix: 28 } }],
    ]),
    '2026-01-01T00:00:00.000Z',
  ),
];

const clonePreset = (preset: PedalboardPreset): PedalboardPreset => ({
  ...preset,
  pedals: clonePedals(preset.pedals),
});

const writePresets = (presets: PedalboardPreset[]) => {
  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify({ version: 1, presets }));
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

    return presets.map(normalizePreset).filter(Boolean) as PedalboardPreset[];
  } catch {
    return null;
  }
};

const normalizePreset = (value: unknown): PedalboardPreset | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PedalboardPreset>;
  if (!candidate.name || !Array.isArray(candidate.pedals)) {
    return null;
  }

  return buildPreset(
    typeof candidate.id === 'string' ? candidate.id : createId('imported'),
    candidate.name,
    {
      pedals: normalizePedals(candidate.pedals),
      masterVolume: typeof candidate.masterVolume === 'number' ? candidate.masterVolume : 0.35,
      tempoBpm: typeof candidate.tempoBpm === 'number' ? candidate.tempoBpm : 120,
    },
    typeof candidate.createdAt === 'string' ? candidate.createdAt : nowIso(),
    typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso(),
  );
};

const normalizeParams = (params: Record<string, PedalParamValue>) =>
  normalizePedalParams(params);

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: DEFAULT_PRESETS.map(clonePreset),
  activePresetId: 'default-clean-practice',
  currentPresetName: 'Clean Practice',
  hydratePresets: () => {
    const presets = readPresets() ?? DEFAULT_PRESETS.map(clonePreset);
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
    const preset = buildPreset(createId(), name, snapshot);
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

    const updatedPreset = buildPreset(sourcePreset.id, sourcePreset.name, snapshot, sourcePreset.createdAt, nowIso());
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
      preset.id === id ? { ...preset, name: sanitizeName(name, preset.name), updatedAt: nowIso() } : preset,
    );
    const activePreset = presets.find((preset) => preset.id === get().activePresetId);
    writePresets(presets);
    set({ presets, currentPresetName: activePreset?.name ?? get().currentPresetName });
  },
  deletePreset: (id) => {
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

    const duplicated = buildPreset(createId('copy'), `${source.name} Copy`, source);
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
    const imported = values.map(normalizePreset).filter(Boolean) as PedalboardPreset[];
    const existingIds = new Set(get().presets.map((preset) => preset.id));
    const uniqueImported = imported.map((preset) =>
      existingIds.has(preset.id) ? { ...preset, id: createId('imported'), name: `${preset.name} Imported` } : preset,
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
  exportPresets: () => JSON.stringify({ version: 1, presets: get().presets.map(clonePreset) }, null, 2),
}));
