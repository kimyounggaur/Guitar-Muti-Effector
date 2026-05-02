import { create } from 'zustand';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type TempoStore = {
  bpm: number;
  lastTapAt: number | null;
  tapTimes: number[];
  setBpm: (bpm: number) => number;
  tapTempo: () => number;
  resetTapTempo: () => void;
};

export const useTempoStore = create<TempoStore>((set, get) => ({
  bpm: 120,
  lastTapAt: null,
  tapTimes: [],
  setBpm: (bpm) => {
    const nextBpm = clamp(Math.round(bpm), 40, 240);
    set({ bpm: nextBpm });
    return nextBpm;
  },
  tapTempo: () => {
    const now = performance.now();
    const previousTaps = get().tapTimes.filter((tapTime) => now - tapTime < 2200);
    const tapTimes = [...previousTaps, now].slice(-5);

    if (tapTimes.length < 2) {
      set({ tapTimes, lastTapAt: now });
      return get().bpm;
    }

    const intervals = tapTimes.slice(1).map((tapTime, index) => tapTime - tapTimes[index]);
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = clamp(Math.round(60000 / averageInterval), 40, 240);
    set({ bpm, tapTimes, lastTapAt: now });
    return bpm;
  },
  resetTapTempo: () => set({ tapTimes: [], lastTapAt: null }),
}));
