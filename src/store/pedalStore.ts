import { create } from 'zustand';
import { Pedal, PedalParamValue, createDefaultPedals, normalizePedals } from '../audio/types';

type PedalStore = {
  pedals: Pedal[];
  activePedalId: string | null;
  selectedPedalId: string | null;
  draggingPedalId: string | null;
  togglePedal: (id: string) => void;
  setPedalBypass: (id: string, bypassed: boolean) => void;
  updatePedalParam: (id: string, paramName: string, value: PedalParamValue) => void;
  setPedals: (pedals: Pedal[]) => void;
  setSelectedPedal: (id: string | null) => void;
  setDraggingPedal: (id: string | null) => void;
  reorderPedals: (oldIndex: number, newIndex: number) => void;
  resetPedals: () => void;
};

const mergeWithDefaultPedals = (pedals: unknown) => normalizePedals(pedals);

export const usePedalStore = create<PedalStore>((set) => ({
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
  setPedals: (pedals) => {
    const nextPedals = mergeWithDefaultPedals(pedals);
    set({
      pedals: nextPedals,
      activePedalId: null,
      selectedPedalId: nextPedals[0]?.id ?? null,
      draggingPedalId: null,
    });
  },
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

      return { pedals };
    }),
  resetPedals: () => {
    const pedals = createDefaultPedals();
    set({ pedals, activePedalId: null, selectedPedalId: null, draggingPedalId: null });
  },
}));
