import { useEffect, useMemo, useState } from 'react';
import { scrollTargetRef } from '../../app/scrollTargets';
import { useAudioStore } from '../../store/audioStore';
import { usePedalStore } from '../../store/pedalStore';
import {
  PedalboardPreset,
  PresetSnapshot,
  getFactoryPresetCategories,
  usePresetStore,
} from '../../store/presetStore';
import { useTempoStore } from '../../store/tempoStore';
import ImportExportPreset from './ImportExportPreset';
import PresetCard from './PresetCard';
import '../../styles/components/preset-panel.css';
import { formatCategory, t } from '../../i18n/ko';
import { showToast } from '../common/Toast';

type PresetPanelProps = {
  onLoadPreset: (preset: PedalboardPreset) => void;
};

const ALL_PRESETS = 'All Presets';
const NO_CATEGORY = '';
const PHONE_QUERY = '(max-width: 600px)';
const USER_PRESETS = 'User Presets';

function PresetPanel({ onLoadPreset }: PresetPanelProps) {
  const pedals = usePedalStore((state) => state.pedals);
  const masterVolume = useAudioStore((state) => state.masterVolume);
  const tempoBpm = useTempoStore((state) => state.bpm);
  const presets = usePresetStore((state) => state.presets);
  const activePresetId = usePresetStore((state) => state.activePresetId);
  const hydratePresets = usePresetStore((state) => state.hydratePresets);
  const savePreset = usePresetStore((state) => state.savePreset);
  const updateActivePreset = usePresetStore((state) => state.updateActivePreset);
  const loadPreset = usePresetStore((state) => state.loadPreset);
  const renamePreset = usePresetStore((state) => state.renamePreset);
  const deletePreset = usePresetStore((state) => state.deletePreset);
  const duplicatePreset = usePresetStore((state) => state.duplicatePreset);
  const [presetName, setPresetName] = useState(t('panel.preset.newName'));
  // On phones (max-width: 600px) the list starts folded: no category is open until one is tapped.
  const [selectedCategory, setSelectedCategory] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches ? NO_CATEGORY : ALL_PRESETS,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    hydratePresets();
  }, [hydratePresets]);

  const createSnapshot = (): PresetSnapshot => ({
    pedals,
    masterVolume,
    outputTrimDb: useAudioStore.getState().presetTrimDb,
    tempoBpm,
  });

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    presets.forEach((preset) => {
      counts.set(preset.category, (counts.get(preset.category) ?? 0) + 1);
    });
    counts.set(ALL_PRESETS, presets.length);
    counts.set(USER_PRESETS, presets.filter((preset) => preset.origin !== 'factory' || preset.category === USER_PRESETS).length);
    return counts;
  }, [presets]);

  const libraryCategories = useMemo(() => {
    const factoryCategories = getFactoryPresetCategories();
    const extraCategories = [...new Set(presets.map((preset) => preset.category))].filter(
      (category) => category !== USER_PRESETS && !factoryCategories.includes(category),
    );
    return [ALL_PRESETS, ...factoryCategories, ...extraCategories, USER_PRESETS];
  }, [presets]);

  const filteredPresets = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (selectedCategory === NO_CATEGORY && !normalizedSearch) return [];
    return presets.filter((preset) => {
      const categoryMatch =
        selectedCategory === ALL_PRESETS ||
        selectedCategory === NO_CATEGORY ||
        (selectedCategory === USER_PRESETS
          ? preset.origin !== 'factory' || preset.category === USER_PRESETS
          : preset.category === selectedCategory);

      if (!categoryMatch) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [preset.name, preset.category, formatCategory(preset.category), preset.origin, preset.description, ...preset.tags]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [presets, searchQuery, selectedCategory]);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) ?? null,
    [activePresetId, presets],
  );

  const handleSavePreset = () => {
    const preset = savePreset(presetName, createSnapshot());
    setPresetName(t('panel.preset.copyName', { name: preset.name }));
    setSelectedCategory(USER_PRESETS);
    setSaveStatus(t('toast.presetSaved'));
    showToast('toast.presetSaved');
  };

  const handleUpdateActive = () => {
    if (!activePreset || activePreset.origin === 'factory') {
      setSaveStatus(t('panel.preset.factoryLocked'));
      return;
    }
    if (!window.confirm(t('confirm.overwritePreset'))) return;
    updateActivePreset(createSnapshot());
    setSaveStatus(t('toast.presetUpdated'));
    showToast('toast.presetUpdated');
  };

  const handleLoad = (preset: PedalboardPreset) => {
    const loadedPreset = loadPreset(preset.id);
    if (loadedPreset) {
      onLoadPreset(loadedPreset);
    }
  };

  const handleDuplicate = (id: string) => {
    const preset = duplicatePreset(id);
    if (preset) {
      setSelectedCategory(USER_PRESETS);
      onLoadPreset(preset);
    }
  };

  return (
    <section className="preset-section preset-library-section" aria-label={t('panel.preset.library')}>
      <details ref={scrollTargetRef('presets')} className="preset-browser-frame">
        <summary>{t('panel.preset.openLibrary', { count: presets.length })}</summary>
        <header className="preset-browser-topline">
          <span>{t('panel.preset.library')}</span>
          <span>{t('panel.preset.all')}</span>
          <strong>{presets.length}</strong>
        </header>

        <div className="preset-browser-grid">
          <aside className="preset-library-sidebar" aria-label={t('panel.preset.categories')}>
            <div className="preset-category-list">
              {libraryCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={category === selectedCategory ? 'is-active' : ''}
                  onClick={() => setSelectedCategory(category)}
                >
                  <span>{formatCategory(category)}</span>
                  <b>{categoryCounts.get(category) ?? 0}</b>
                </button>
              ))}
            </div>

            <div className="preset-tools-panel">
              <span>{t('panel.preset.tools')}</span>
              <label>
                <small>{t('panel.preset.name')}</small>
                <input type="text" value={presetName} onChange={(event) => setPresetName(event.target.value)} />
              </label>
              <div className="preset-tool-buttons">
                <button type="button" onClick={handleSavePreset}>
                  
                  {t('panel.preset.saveNew')}
                </button>
                <button type="button" onClick={handleUpdateActive} disabled={!activePresetId || activePreset?.origin === 'factory'}>
                  
                  {t('panel.preset.saveCurrent')}
                </button>
              </div>
              <p role="status">{saveStatus}</p>
              <ImportExportPreset compact />
            </div>

          </aside>

          <div className="preset-browser-main">
            <div className="preset-list-header">
              <div>
                <h2>{formatCategory(selectedCategory)}</h2>
                <span>
                  {t('panel.preset.count', { count: filteredPresets.length })}
                  {activePreset ? t('panel.preset.current', { name: activePreset.name }) : ''}
                </span>
              </div>
              <strong>{Math.round(masterVolume * 100)}% · {tempoBpm} BPM</strong>
            </div>

            <label className="preset-search-box">
              <span>{t('panel.preset.search')}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('panel.preset.search')}
              />
            </label>

            <div className="preset-list preset-library-list">
              {filteredPresets.length ? (
                filteredPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    active={preset.id === activePresetId}
                    onLoad={handleLoad}
                    onRename={renamePreset}
                    onDelete={deletePreset}
                    onDuplicate={handleDuplicate}
                  />
                ))
              ) : (
                <div className="preset-empty-state">
                  {selectedCategory === NO_CATEGORY && !searchQuery.trim() ? t('panel.preset.pickCategory') : t('panel.preset.noMatch')}
                </div>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

export default PresetPanel;
