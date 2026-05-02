import { clamp } from './curves';

export const clampBpm = (bpm: number) => clamp(bpm, 40, 240);

export const bpmToQuarterMs = (bpm: number) => 60000 / clampBpm(bpm);

export const noteDivisionToMs = (bpm: number, division: 1 | 2 | 4 | 8 | 16 = 4) =>
  bpmToQuarterMs(bpm) * (4 / division);

export const tempoFromTapTimes = (tapTimes: number[]) => {
  if (tapTimes.length < 2) {
    return null;
  }

  const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
  const average = intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
  return clampBpm(60000 / average);
};
