// Reading presets saved by older versions, and turning edited factory presets into user presets.
import { normalizePedals } from '../audio/types';
import { buildPreset, clonePreset, createId, nowIso, sanitizeCategory, sanitizeOrigin, sanitizeTags } from './build';
import { FACTORY_CREATED_AT, buildFactoryPresets } from './factory';
import type { PedalboardPreset, PresetOrigin } from './types';

export const LEGACY_FACTORY_IDS = new Set([
  'default-clean-practice',
  'default-blues-lead',
  'default-classic-rock',
  'default-high-gain',
  'default-ambient-delay',
  'default-fuzz-experiment',
]);

export const presetListFrom = (parsed: unknown): unknown[] | null =>
  Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed && 'presets' in parsed && Array.isArray(parsed.presets)
      ? parsed.presets
      : null;

export const normalizePresetList = (parsed: unknown) =>
  (presetListFrom(parsed) ?? []).map((preset) => normalizePreset(preset, 'user')).filter(Boolean) as PedalboardPreset[];

/** User presets from the stored v3 list (factory presets are never stored). */
export const normalizeUserPresetList = (parsed: unknown): PedalboardPreset[] =>
  mergeWithFactoryLibrary(normalizePresetList(parsed)).filter((preset) => preset.origin !== 'factory');

/** The old preset key: edited factory presets become '(이전 사용자 설정)' user presets. */
export const migrateLegacyPresetList = (parsed: unknown): PedalboardPreset[] => normalizeUserPresetList(parsed);

export const inferCategory = (name: string) => {
  const lower = name.toLowerCase();

  if (lower.includes('bass')) return 'Bass';
  if (lower.includes('lead') || lower.includes('solo')) return 'Lead';
  if (lower.includes('gain') || lower.includes('metal')) return 'High Gain';
  if (lower.includes('ambient') || lower.includes('delay') || lower.includes('cloud')) return 'Ambient';
  if (lower.includes('chorus') || lower.includes('phaser') || lower.includes('trem')) return 'Modulation';
  if (lower.includes('fuzz') || lower.includes('experiment')) return 'Experimental';
  if (lower.includes('crunch') || lower.includes('rock')) return 'Crunch';
  return 'Clean';
};

export function isPresetRecord(value: unknown): value is Record<string, unknown> & { name: string; pedals: unknown[] } {
  return value !== null && typeof value === 'object'
    && 'name' in value && typeof value.name === 'string' && value.name.length > 0
    && 'pedals' in value && Array.isArray(value.pedals);
}

export const normalizePreset = (candidate: unknown, fallbackOrigin: PresetOrigin): PedalboardPreset | null => {
  if (!isPresetRecord(candidate)) {
    return null;
  }

  const id = typeof candidate.id === 'string' ? candidate.id : createId('imported');
  const fallbackCategory = id.startsWith('factory-') || LEGACY_FACTORY_IDS.has(id) ? inferCategory(candidate.name) : 'User Presets';
  const fallbackForOrigin = id.startsWith('factory-') || LEGACY_FACTORY_IDS.has(id) ? 'factory' : fallbackOrigin;

  return buildPreset(
    id,
    candidate.name,
    {
      pedals: normalizePedals(candidate.pedals),
      masterVolume: typeof candidate.masterVolume === 'number' ? candidate.masterVolume : 0.35,
      outputTrimDb: typeof candidate.outputTrimDb === 'number' && Number.isFinite(candidate.outputTrimDb) ? candidate.outputTrimDb : 0,
      tempoBpm: typeof candidate.tempoBpm === 'number' ? candidate.tempoBpm : 120,
    },
    typeof candidate.createdAt === 'string' ? candidate.createdAt : nowIso(),
    typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso(),
    {
      category: sanitizeCategory(candidate.category, fallbackCategory),
      origin: sanitizeOrigin(candidate.origin, fallbackForOrigin),
      description: typeof candidate.description === 'string' ? candidate.description : '',
      tags: sanitizeTags(candidate.tags),
    },
  );
};

export const mergeWithFactoryLibrary = (storedPresets: PedalboardPreset[] | null) => {
  const factoryPresets = buildFactoryPresets().map(clonePreset);
  // Old versions let users overwrite or rename factory presets. Preserve those edits
  // as separate user presets while always loading the current factory library.
  const userPresets = (storedPresets ?? []).flatMap((preset) => {
    const hadFactoryId = preset.id.startsWith('factory-') || LEGACY_FACTORY_IDS.has(preset.id);
    if (hadFactoryId) {
      if (preset.origin === 'factory' && preset.updatedAt === FACTORY_CREATED_AT) return [];
      return [{ ...clonePreset(preset), id: `migrated-${preset.id}`, origin: 'user' as const, category: 'User Presets', name: `${preset.name} (이전 사용자 설정)` }];
    }
    return preset.origin === 'factory' ? [] : [clonePreset(preset)];
  });
  return [...factoryPresets, ...userPresets];
};

