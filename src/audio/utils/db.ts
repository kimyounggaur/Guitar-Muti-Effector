import { clamp } from './curves';

export const MIN_DB = -120;

export const gainToDb = (gain: number) => 20 * Math.log10(Math.max(gain, 0.000001));

export const dbToGain = (db: number) => 10 ** (db / 20);

export const rmsToDb = (rms: number) => gainToDb(rms);

export const meterDbToPercent = (db: number) => clamp((db + 60) / 60, 0, 1);

export const formatDb = (db: number) => (db <= -90 ? '-inf dB' : `${db.toFixed(1)} dB`);
