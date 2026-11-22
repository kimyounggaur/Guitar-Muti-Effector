import { useMemo } from 'react';
import { STOMP_PRESET_CATEGORIES, type StompPresetCategory } from '../components/hardware/FootSwitchPanel';
import { usePedalStore } from '../store/pedalStore';
import { type PedalboardPreset, usePresetStore } from '../store/presetStore';

const isPresetInStompCategory = (preset: PedalboardPreset, category: StompPresetCategory) =>
  category === 'User Presets'
    ? preset.origin !== 'factory' || preset.category === 'User Presets'
    : preset.category === category;

/** Values derived for the LCD header, preset grid and foot switches (moved from App.tsx). */
export function useStompView(activePresetCategory: StompPresetCategory | null) {
  const presets = usePresetStore((state) => state.presets);
  const activePresetId = usePresetStore((state) => state.activePresetId);
  const pedals = usePedalStore((state) => state.pedals);

  const patchAddress = useMemo(() => {
    const factoryIndex = presets.filter((preset) => preset.origin === 'factory').findIndex((preset) => preset.id === activePresetId);
    return factoryIndex >= 0
      ? { bank: 'A', patch: String(factoryIndex + 1).padStart(3, '0') }
      : { bank: activePresetId ? 'USER' : 'EDIT', patch: '—' };
  }, [activePresetId, presets]);
  const presetCategoryCounts = useMemo(
    () =>
      STOMP_PRESET_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
        counts[category] = presets.filter((preset) => isPresetInStompCategory(preset, category)).length;
        return counts;
      }, {}),
    [presets],
  );
  const lcdCategoryPresets = useMemo(
    () => (activePresetCategory ? presets.filter((preset) => isPresetInStompCategory(preset, activePresetCategory)) : []),
    [activePresetCategory, presets],
  );
  const footSwitchEffectPedals = useMemo(
    () => pedals.filter((pedal) => pedal.type !== 'tuner').slice(0, STOMP_PRESET_CATEGORIES.length),
    [pedals],
  );

  return { patchAddress, presetCategoryCounts, lcdCategoryPresets, footSwitchEffectPedals };
}
