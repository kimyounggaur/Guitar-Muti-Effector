import type { PedalParamValue, PedalType } from '../../../audio/types';
import { t, tDynamic } from '../../../i18n/ko';

export const readNumberParam = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return clampNumber(value, min, max);
};

export const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const percentFromRange = (value: number, min: number, max: number) => ((clampNumber(value, min, max) - min) / (max - min)) * 100;


/** Korean pedal name from src/i18n/ko.ts. */
export const formatPedalType = (type: PedalType) => t(`pedal.${type}.name`);

/** Korean parameter label from src/i18n/ko.ts; unknown names fall back to a spaced version of the key. */
export const formatParamName = (name: string, type?: PedalType) =>
  tDynamic(
    `param.${type ?? ''}.${name}`,
    name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
      .replace('Db', 'dB')
      .replace('Ms', 'ms'),
  );
