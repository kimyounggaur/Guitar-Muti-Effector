import { arrayMove } from '@dnd-kit/sortable';
import { create } from 'zustand';
import { Preset, Pedal, clonePedals, createInitialPedals } from '../audio/types';

const PRESET_STORAGE_KEY = 'web-pedalboard-lab-presets-v1';

type PedalStore = {
  pedals: Pedal[];
  masterVolume: number;
  selectedDeviceId: string;
  isDragging: boolean;
  presets: Preset[];
  selectedPresetId: string | null;
  setSelectedDeviceId: (deviceId: string) => void;
  setMasterVolume: (volume: number) => void;
  setDragging: (isDragging: boolean) => void;
  updatePedal: (pedalId: string, patch: Partial<Omit<Pedal, 'params'>> & { params?: Record<string, number> }) => void;
  setPedalParam: (pedalId: string, key: string, value: number) => void;
  reorderPedals: (activeId: string, overId: string) => void;
  savePreset: (name: string) => string;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  resetFactory: () => void;
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

export const usePedalStore = create<PedalStore>((set, get) => ({
  pedals: createInitialPedals(),
  masterVolume: 0.82,
  selectedDeviceId: '',
  isDragging: false,
  presets: readPresets(),
  selectedPresetId: null,
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setDragging: (isDragging) => set({ isDragging }),
  updatePedal: (pedalId, patch) =>
    set((state) => ({
      pedals: state.pedals.map((pedal) =>
        pedal.id === pedalId
          ? {
              ...pedal,
              ...patch,
              params: patch.params ? { ...pedal.params, ...patch.params } : pedal.params,
            }
          : pedal,
      ),
    })),
  setPedalParam: (pedalId, key, value) =>
    set((state) => ({
      pedals: state.pedals.map((pedal) =>
        pedal.id === pedalId
          ? {
              ...pedal,
              params: {
                ...pedal.params,
                [key]: value,
              },
            }
          : pedal,
      ),
    })),
  reorderPedals: (activeId, overId) =>
    set((state) => {
      const oldIndex = state.pedals.findIndex((pedal) => pedal.id === activeId);
      const newIndex = state.pedals.findIndex((pedal) => pedal.id === overId);

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return state;
      }

      return {
        pedals: arrayMove(state.pedals, oldIndex, newIndex),
      };
    }),
  savePreset: (name) => {
    const cleanName = name.trim() || `Preset ${get().presets.length + 1}`;
    const preset: Preset = {
      id: createPresetId(),
      name: cleanName,
      createdAt: Date.now(),
      pedals: clonePedals(get().pedals),
      masterVolume: get().masterVolume,
    };
    const presets = [preset, ...get().presets].slice(0, 32);
    writePresets(presets);
    set({ presets, selectedPresetId: preset.id });
    return preset.id;
  },
  loadPreset: (id) => {
    const preset = get().presets.find((item) => item.id === id);
    if (!preset) {
      return;
    }

    set({
      pedals: clonePedals(preset.pedals),
      masterVolume: preset.masterVolume,
      selectedPresetId: id,
    });
  },
  deletePreset: (id) => {
    const presets = get().presets.filter((preset) => preset.id !== id);
    writePresets(presets);
    set((state) => ({
      presets,
      selectedPresetId: state.selectedPresetId === id ? null : state.selectedPresetId,
    }));
  },
  resetFactory: () =>
    set({
      pedals: createInitialPedals(),
      masterVolume: 0.82,
      selectedPresetId: null,
    }),
}));
