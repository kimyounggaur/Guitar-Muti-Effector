import { useEffect, useState } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { usePedalStore } from '../../store/pedalStore';
import { PedalboardPreset, PresetSnapshot, usePresetStore } from '../../store/presetStore';
import { useTempoStore } from '../../store/tempoStore';
import ImportExportPreset from './ImportExportPreset';
import PresetCard from './PresetCard';

type PresetPanelProps = {
  onLoadPreset: (preset: PedalboardPreset) => void;
};

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

  useEffect(() => {
    hydratePresets();
  }, [hydratePresets]);

  const createSnapshot = (): PresetSnapshot => ({
    pedals,
    masterVolume,
    tempoBpm,
  });

  const handleSavePreset = () => {
    const preset = savePreset(presetName, createSnapshot());
    setPresetName(`${preset.name} Copy`);
  };

  const handleUpdateActive = () => {
    updateActivePreset(createSnapshot());
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
      onLoadPreset(preset);
    }
  };

  return (
    <section className="preset-section" aria-label="Presets">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Preset memory</span>
          <h2>Presets</h2>
          <p className="preset-summary">
            {presets.length} presets · Current master {Math.round(masterVolume * 100)}% · {tempoBpm} BPM
          </p>
        </div>
      </div>

      <div className="preset-save-panel">
        <label>
          <span>Preset Name</span>
          <input type="text" value={presetName} onChange={(event) => setPresetName(event.target.value)} />
        </label>
        <button type="button" onClick={handleSavePreset}>
          Save Preset
        </button>
        <button type="button" onClick={handleUpdateActive} disabled={!activePresetId}>
          Save Current
        </button>
      </div>

      <div className="preset-list">
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            active={preset.id === activePresetId}
            onLoad={handleLoad}
            onRename={renamePreset}
            onDelete={deletePreset}
            onDuplicate={handleDuplicate}
          />
        ))}
      </div>

      <ImportExportPreset />
    </section>
  );
}

export default PresetPanel;
