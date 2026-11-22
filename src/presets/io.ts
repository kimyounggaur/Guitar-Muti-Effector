// Preset files: export the user's presets, import a file while skipping duplicates and factory presets.
import { clonePreset } from './build';
import { normalizePreset } from './migrate';
import type { PedalboardPreset } from './types';

/** JSON text with the user's own presets only (factory presets are never exported). */
export function exportUserPresets(presets: readonly PedalboardPreset[]): string {
  return JSON.stringify({ version: 3, presets: presets.filter((preset) => preset.origin !== 'factory').map(clonePreset) }, null, 2);
}

/**
 * Parses an exported file (a list, { presets: [...] } or a single preset).
 * Returns only the new presets to add; JSON.parse errors are passed to the caller as before.
 */
export function importPresets(json: string, existing: readonly PedalboardPreset[]): { presets: PedalboardPreset[]; imported: number; skipped: number } {
  const parsed = JSON.parse(json) as unknown;
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed && 'presets' in parsed && Array.isArray(parsed.presets)
      ? parsed.presets
      : [parsed];
  const imported = values.map((preset) => normalizePreset(preset, 'imported')).filter(Boolean) as PedalboardPreset[];
  const existingIds = new Set(existing.map((preset) => preset.id));
  const uniqueImported = imported.filter((preset) => {
    if (preset.origin === 'factory' || preset.id.startsWith('factory-') || existingIds.has(preset.id)) return false;
    existingIds.add(preset.id);
    return true;
  }).map((preset) => ({ ...preset, origin: 'imported' as const }));
  return { presets: uniqueImported, imported: uniqueImported.length, skipped: values.length - uniqueImported.length };
}
