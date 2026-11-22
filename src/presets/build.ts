// Shared preset construction and sanitising (used by the factory library, migration, import and the store).
import { normalizePedals, type Pedal } from '../audio/types';
import type { PedalboardPreset, PresetMetadata, PresetOrigin, PresetSnapshot } from './types';

export const clonePedals = (pedals: Pedal[]) => normalizePedals(pedals);

export const createId = (prefix = 'preset') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const nowIso = () => new Date().toISOString();

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const sanitizeName = (name: string, fallback = 'Untitled Preset') => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 64) : fallback;
};

export const sanitizeCategory = (category: unknown, fallback = 'User Presets') =>
  typeof category === 'string' && category.trim() ? category.trim().slice(0, 32) : fallback;

export const sanitizeOrigin = (origin: unknown, fallback: PresetOrigin): PresetOrigin =>
  origin === 'factory' || origin === 'user' || origin === 'imported' ? origin : fallback;

export const sanitizeTags = (tags: unknown): string[] =>
  Array.isArray(tags)
    ? [...new Set(tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map((tag) => tag.trim()))].slice(0, 10)
    : [];

export const buildPreset = (
  id: string,
  name: string,
  snapshot: PresetSnapshot,
  createdAt = nowIso(),
  updatedAt = createdAt,
  metadata: PresetMetadata = {},
): PedalboardPreset => ({
  id,
  name: sanitizeName(name),
  category: sanitizeCategory(metadata.category, metadata.origin === 'factory' ? 'Clean' : 'User Presets'),
  origin: sanitizeOrigin(metadata.origin, 'user'),
  description: typeof metadata.description === 'string' ? metadata.description.trim().slice(0, 140) : '',
  tags: sanitizeTags(metadata.tags),
  pedals: clonePedals(snapshot.pedals),
  masterVolume: clamp(snapshot.masterVolume, 0, 1),
  outputTrimDb: Number.isFinite(snapshot.outputTrimDb) ? clamp(snapshot.outputTrimDb, -36, 0) : 0,
  tempoBpm: Math.round(clamp(snapshot.tempoBpm, 40, 240)),
  createdAt,
  updatedAt,
});

export const clonePreset = (preset: PedalboardPreset): PedalboardPreset => ({
  ...preset,
  pedals: clonePedals(preset.pedals),
  tags: [...preset.tags],
});
