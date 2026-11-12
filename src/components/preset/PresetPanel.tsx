import { useEffect, useMemo, useState } from 'react';
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

type PresetPanelProps = {
  onLoadPreset: (preset: PedalboardPreset) => void;
};

const ALL_PRESETS = 'All Presets';
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
  const [presetName, setPresetName] = useState('New Preset');
  const [selectedCategory, setSelectedCategory] = useState(ALL_PRESETS);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    hydratePresets();
  }, [hydratePresets]);

  const createSnapshot = (): PresetSnapshot => ({
    pedals,
    masterVolume,
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
    return presets.filter((preset) => {
      const categoryMatch =
        selectedCategory === ALL_PRESETS ||
        (selectedCategory === USER_PRESETS
          ? preset.origin !== 'factory' || preset.category === USER_PRESETS
          : preset.category === selectedCategory);

      if (!categoryMatch) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [preset.name, preset.category, preset.origin, preset.description, ...preset.tags]
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
    setPresetName(`${preset.name} Copy`);
    setSelectedCategory(USER_PRESETS);
    setSaveStatus('사용자 프리셋을 저장했습니다.');
  };

  const handleUpdateActive = () => {
    if (!activePreset || activePreset.origin === 'factory') {
      setSaveStatus('공장 프리셋은 직접 덮어쓸 수 없습니다. 새 프리셋으로 저장해 주세요.');
      return;
    }
    if (!window.confirm('현재 사용자 프리셋을 덮어쓰시겠습니까?')) return;
    updateActivePreset(createSnapshot());
    setSaveStatus('현재 프리셋을 저장했습니다.');
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
    <section className="preset-section preset-library-section" aria-label="Preset library">
      <details className="preset-browser-frame">
        <summary>프리셋 라이브러리 열기 · {presets.length}개</summary>
        <header className="preset-browser-topline">
          <span>LIBRARY STORE</span>
          <span>PRESETS</span>
          <strong>{presets.length}</strong>
        </header>

        <div className="preset-browser-grid">
          <aside className="preset-library-sidebar" aria-label="Preset library categories">
            <div className="preset-category-list">
              {libraryCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={category === selectedCategory ? 'is-active' : ''}
                  onClick={() => setSelectedCategory(category)}
                >
                  <span>{category}</span>
                  <b>{categoryCounts.get(category) ?? 0}</b>
                </button>
              ))}
            </div>

            <div className="preset-tools-panel">
              <span>Preset Tools</span>
              <label>
                <small>Preset name</small>
                <input type="text" value={presetName} onChange={(event) => setPresetName(event.target.value)} />
              </label>
              <div className="preset-tool-buttons">
                <button type="button" onClick={handleSavePreset}>
                  Save
                </button>
                <button type="button" onClick={handleUpdateActive} disabled={!activePresetId || activePreset?.origin === 'factory'}>
                  Save Current
                </button>
              </div>
              <p role="status">{saveStatus}</p>
              <ImportExportPreset compact />
            </div>

          </aside>

          <div className="preset-browser-main">
            <div className="preset-list-header">
              <div>
                <h2>{selectedCategory}</h2>
                <span>
                  {filteredPresets.length} sounds
                  {activePreset ? ` · Current: ${activePreset.name}` : ''}
                </span>
              </div>
              <strong>{Math.round(masterVolume * 100)}% · {tempoBpm} BPM</strong>
            </div>

            <label className="preset-search-box">
              <span>Search presets</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search presets"
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
                <div className="preset-empty-state">No presets match this filter.</div>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

export default PresetPanel;
