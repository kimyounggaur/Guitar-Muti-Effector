import { create } from 'zustand';
import { clampBpm, tempoFromTapTimes } from '../audio/utils/tempo';

type TempoStore = {
  bpm: number;
  tapTimes: number[];
  setBpm: (bpm: number) => void;
  tap: () => void;
  resetTap: () => void;
};

export const useTempoStore = create<TempoStore>((set, get) => ({
  bpm: 120,
  tapTimes: [],
  setBpm: (bpm) => set({ bpm: clampBpm(bpm) }),
  tap: () => {
    const now = performance.now();
    const tapTimes = [...get().tapTimes, now].filter((time) => now - time < 2500).slice(-6);
    const bpm = tempoFromTapTimes(tapTimes);
    set({ tapTimes, bpm: bpm ?? get().bpm });
  },
  resetTap: () => set({ tapTimes: [] }),
}));
