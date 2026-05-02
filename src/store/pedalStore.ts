import { create } from 'zustand';
import { Pedal, PedalParamValue, PedalType, createDefaultPedals } from '../audio/types';

const PEDAL_STORAGE_KEY = 'guitar-multi-effector-pedals-v1';

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
  savePedalsToStorage: () => void;
  loadPedalsFromStorage: () => void;
};

const isPedalParamValue = (value: unknown): value is PedalParamValue =>
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean';

const isPedalType = (value: unknown): value is PedalType =>
  value === 'tuner' ||
  value === 'noiseGate' ||
  value === 'compressor' ||
  value === 'drive' ||
  value === 'ampEQ' ||
  value === 'cabinetIR' ||
  value === 'modulation' ||
  value === 'delay' ||
  value === 'reverb' ||
  value === 'looper' ||
  value === 'rhythm';

const normalizeParams = (params: unknown): Record<string, PedalParamValue> => {
  if (!params || typeof params !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, PedalParamValue] => isPedalParamValue(entry[1])),
  );
};

const clonePedals = (pedals: Pedal[]) =>
  pedals.map((pedal) => ({
    ...pedal,
    params: normalizeParams(pedal.params),
  }));

const mergeWithDefaultPedals = (pedals: unknown) => {
  const defaultPedals = createDefaultPedals();
  const defaultById = new Map(defaultPedals.map((pedal) => [pedal.id, pedal]));
  const sourcePedals = Array.isArray(pedals) ? pedals : [];
  const normalizedPedals = sourcePedals
    .filter((pedal): pedal is Partial<Pedal> => Boolean(pedal) && typeof pedal === 'object')
    .map((pedal) => {
      const id = typeof pedal.id === 'string' ? pedal.id : '';
      const fallback = defaultById.get(id);
      const type = isPedalType(pedal.type) ? pedal.type : fallback?.type;

      if (!id || !type) {
        return null;
      }

      return {
        id,
        type,
        name: typeof pedal.name === 'string' ? pedal.name : fallback?.name ?? id,
        enabled: typeof pedal.enabled === 'boolean' ? pedal.enabled : fallback?.enabled ?? true,
        bypassed: typeof pedal.bypassed === 'boolean' ? pedal.bypassed : fallback?.bypassed ?? false,
        params: {
          ...(fallback?.params ?? {}),
          ...normalizeParams(pedal.params),
        },
      };
    })
    .filter(Boolean) as Pedal[];
  const existingIds = new Set(normalizedPedals.map((pedal) => pedal.id));
  const missingPedals = defaultPedals.filter((pedal) => !existingIds.has(pedal.id));
  return [...clonePedals(normalizedPedals), ...clonePedals(missingPedals)];
};

const readStoredPedals = () => {
  try {
    const raw = window.localStorage.getItem(PEDAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
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
  setPedals: (pedals) => {
    const nextPedals = mergeWithDefaultPedals(pedals);
    writeStoredPedals(nextPedals);
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
      const pedals = mergeWithDefaultPedals(storedPedals);
      writeStoredPedals(pedals);
      set({ pedals, selectedPedalId: pedals[0]?.id ?? null });
    }
  },
}));
