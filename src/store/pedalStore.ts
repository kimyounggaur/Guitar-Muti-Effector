import { arrayMove } from '@dnd-kit/sortable';
import { create } from 'zustand';
import { Pedal, PedalPatch, clonePedals, createInitialPedals } from '../audio/types';

type PedalStore = {
  pedals: Pedal[];
  isDragging: boolean;
  setDragging: (isDragging: boolean) => void;
  updatePedal: (pedalId: string, patch: PedalPatch) => void;
  setPedalParam: (pedalId: string, key: string, value: number) => void;
  reorderPedals: (activeId: string, overId: string) => void;
  setPedals: (pedals: Pedal[]) => void;
  resetPedals: () => void;
};

export const usePedalStore = create<PedalStore>((set) => ({
  pedals: createInitialPedals(),
  isDragging: false,
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
  setPedals: (pedals) => set({ pedals: clonePedals(pedals) }),
  resetPedals: () => set({ pedals: createInitialPedals() }),
}));
