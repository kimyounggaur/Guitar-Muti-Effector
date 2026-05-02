import { create } from 'zustand';
import { Pedal, Preset, clonePedals } from '../audio/types';

const PRESET_STORAGE_KEY = 'web-pedalboard-lab-presets-v1';

type PresetStore = {
  presets: Preset[];
  selectedPresetId: string | null;
  savePreset: (name: string, pedals: Pedal[], masterVolume: number) => string;
  getPreset: (id: string) => Preset | undefined;
  selectPreset: (id: string | null) => void;
  deletePreset: (id: string) => void;
};

const canUseStorage = () => typeof window !== 'undefined' && 'localStorage' in window;

const readPresets = (): Preset[] => {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
};

const writePresets = (presets: Preset[]) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
};

const createPresetId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.round(Math.random() * 100000)}`;
};

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: readPresets(),
  selectedPresetId: null,
  savePreset: (name, pedals, masterVolume) => {
    const cleanName = name.trim() || `Preset ${get().presets.length + 1}`;
    const preset: Preset = {
      id: createPresetId(),
      name: cleanName,
      createdAt: Date.now(),
      pedals: clonePedals(pedals),
      masterVolume,
    };
    const presets = [preset, ...get().presets].slice(0, 32);
    writePresets(presets);
    set({ presets, selectedPresetId: preset.id });
    return preset.id;
  },
  getPreset: (id) => get().presets.find((item) => item.id === id),
  selectPreset: (selectedPresetId) => set({ selectedPresetId }),
  deletePreset: (id) => {
    const presets = get().presets.filter((preset) => preset.id !== id);
    writePresets(presets);
    set((state) => ({
      presets,
      selectedPresetId: state.selectedPresetId === id ? null : state.selectedPresetId,
    }));
  },
}));
