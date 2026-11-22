import type { PedalParamValue, PedalType } from '../../../audio/types';

export const readNumberParam = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return clampNumber(value, min, max);
};

export const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const percentFromRange = (value: number, min: number, max: number) => ((clampNumber(value, min, max) - min) / (max - min)) * 100;


export const formatPedalType = (type: PedalType) =>
  type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Ir', 'IR')
    .replace('Eq', 'EQ');

export const formatParamName = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Db', 'dB')
    .replace('Ms', 'ms')
    .replace('A4', 'A4')
    .replace('IR', 'IR');
