import type { Pedal } from '../audio/types';

export type PresetOrigin = 'factory' | 'user' | 'imported';

export type PedalboardPreset = {
  id: string;
  name: string;
  category: string;
  origin: PresetOrigin;
  description: string;
  tags: string[];
  pedals: Pedal[];
  masterVolume: number;
  outputTrimDb: number;
  tempoBpm: number;
  createdAt: string;
  updatedAt: string;
};

export type PresetSnapshot = {
  pedals: Pedal[];
  masterVolume: number;
  outputTrimDb: number;
  tempoBpm: number;
};

export type PresetMetadata = {
  category?: string;
  origin?: PresetOrigin;
  description?: string;
  tags?: string[];
};
