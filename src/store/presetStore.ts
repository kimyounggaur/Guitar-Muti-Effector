// Preset state and actions. Factory library, migration and file I/O live in src/presets/.
import { create } from 'zustand';
import { buildPreset, clonePreset, createId, nowIso, sanitizeName } from '../presets/build';
import { buildFactoryPresets, factoryIds, getFactoryPresetCategories } from '../presets/factory';
import { exportUserPresets, importPresets } from '../presets/io';
import { mergeWithFactoryLibrary, migrateLegacyPresetList, normalizeUserPresetList } from '../presets/migrate';
import type { PedalboardPreset, PresetOrigin, PresetSnapshot } from '../presets/types';
import { loadUserPresets, saveUserPresets } from './persistence';
import { t } from '../i18n/ko';

export type { PedalboardPreset, PresetOrigin, PresetSnapshot };
export { getFactoryPresetCategories, migrateLegacyPresetList, normalizeUserPresetList };

type PresetStore = {
  presets: PedalboardPreset[];
  activePresetId: string | null;
  currentPresetName: string;
  hydratePresets: () => void;
  savePreset: (name: string, snapshot: PresetSnapshot) => PedalboardPreset;
  updateActivePreset: (snapshot: PresetSnapshot) => PedalboardPreset | null;
  loadPreset: (id: string) => PedalboardPreset | null;
  restoreSelection: (id: string | null, name: string) => void;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string) => PedalboardPreset | null;
  importPresets: (json: string) => { imported: number; skipped: number };
  exportPresets: () => string;
};

const writePresets = (presets: PedalboardPreset[]) => {
  saveUserPresets(presets.filter((preset) => preset.origin !== 'factory' && !factoryIds().has(preset.id)));
};

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: buildFactoryPresets().map(clonePreset),
  activePresetId: buildFactoryPresets()[0]?.id ?? null,
  currentPresetName: buildFactoryPresets()[0]?.name ?? 'Init Patch',
  hydratePresets: () => {
    const presets = mergeWithFactoryLibrary(loadUserPresets());
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
      description: t('preset.defaultDescription'),
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

    if (sourcePreset.origin === 'factory') {
      return get().savePreset(`${sourcePreset.name} 사용자 설정`, snapshot);
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
  restoreSelection: (id, name) => set({ activePresetId: id, currentPresetName: name }),
  loadPreset: (id) => {
    const preset = get().presets.find((candidate) => candidate.id === id) ?? null;
    if (!preset) {
      return null;
    }

    set({ activePresetId: preset.id, currentPresetName: preset.name });
    return clonePreset(preset);
  },
  renamePreset: (id, name) => {
    if (get().presets.find((preset) => preset.id === id)?.origin === 'factory') return;
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
    const result = importPresets(json, get().presets);
    const presets = [...result.presets, ...get().presets];
    writePresets(presets);
    set({
      presets,
      activePresetId: result.presets[0]?.id ?? get().activePresetId,
      currentPresetName: result.presets[0]?.name ?? get().currentPresetName,
    });
    return { imported: result.imported, skipped: result.skipped };
  },
  exportPresets: () => exportUserPresets(get().presets),
}));
