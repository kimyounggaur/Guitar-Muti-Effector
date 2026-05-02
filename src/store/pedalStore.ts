import { create } from 'zustand';
import { Pedal, PedalParamValue, createDefaultPedals } from '../audio/types';

const PEDAL_STORAGE_KEY = 'guitar-multi-effector-pedals-v1';

type PedalStore = {
  pedals: Pedal[];
  activePedalId: string | null;
  selectedPedalId: string | null;
  draggingPedalId: string | null;
  togglePedal: (id: string) => void;
  setPedalBypass: (id: string, bypassed: boolean) => void;
  updatePedalParam: (id: string, paramName: string, value: PedalParamValue) => void;
  setSelectedPedal: (id: string | null) => void;
  setDraggingPedal: (id: string | null) => void;
  reorderPedals: (oldIndex: number, newIndex: number) => void;
  resetPedals: () => void;
  savePedalsToStorage: () => void;
  loadPedalsFromStorage: () => void;
};

const clonePedals = (pedals: Pedal[]) =>
  pedals.map((pedal) => ({
    ...pedal,
    params: { ...pedal.params },
  }));

const readStoredPedals = () => {
  try {
    const raw = window.localStorage.getItem(PEDAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pedal[]) : null;
  } catch {
    return null;
  }
};

const writeStoredPedals = (pedals: Pedal[]) => {
  window.localStorage.setItem(PEDAL_STORAGE_KEY, JSON.stringify(pedals));
};

export const usePedalStore = create<PedalStore>((set, get) => ({
  pedals: createDefaultPedals(),
  activePedalId: null,
  selectedPedalId: null,
  draggingPedalId: null,
  togglePedal: (id) =>
    set((state) => ({
      activePedalId: id,
      pedals: state.pedals.map((pedal) =>
        pedal.id === id ? { ...pedal, enabled: !pedal.enabled } : pedal,
      ),
    })),
  setPedalBypass: (id, bypassed) =>
    set((state) => ({
      activePedalId: id,
      pedals: state.pedals.map((pedal) => (pedal.id === id ? { ...pedal, bypassed } : pedal)),
    })),
  updatePedalParam: (id, paramName, value) =>
    set((state) => ({
      activePedalId: id,
      pedals: state.pedals.map((pedal) =>
        pedal.id === id
          ? {
              ...pedal,
              params: {
                ...pedal.params,
                [paramName]: value,
              },
            }
          : pedal,
      ),
    })),
  setSelectedPedal: (selectedPedalId) => set({ selectedPedalId }),
  setDraggingPedal: (draggingPedalId) => set({ draggingPedalId }),
  reorderPedals: (oldIndex, newIndex) =>
    set((state) => {
      if (
        oldIndex === newIndex ||
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= state.pedals.length ||
        newIndex >= state.pedals.length
      ) {
        return state;
      }

      const pedals = [...state.pedals];
      const [movedPedal] = pedals.splice(oldIndex, 1);
      pedals.splice(newIndex, 0, movedPedal);
      writeStoredPedals(pedals);

      return { pedals };
    }),
  resetPedals: () => {
    const pedals = createDefaultPedals();
    writeStoredPedals(pedals);
    set({ pedals, activePedalId: null, selectedPedalId: null, draggingPedalId: null });
  },
  savePedalsToStorage: () => writeStoredPedals(get().pedals),
  loadPedalsFromStorage: () => {
    const storedPedals = readStoredPedals();

    if (storedPedals) {
      set({ pedals: clonePedals(storedPedals), selectedPedalId: storedPedals[0]?.id ?? null });
    }
  },
}));
