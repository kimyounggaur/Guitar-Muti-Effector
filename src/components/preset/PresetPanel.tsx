import { useState } from 'react';
import { Preset } from '../../audio/types';
import ImportExportPreset from './ImportExportPreset';
import PresetCard from './PresetCard';

type PresetPanelProps = {
  presets: Preset[];
  selectedPresetId: string | null;
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onFactoryReset: () => void;
};

function PresetPanel({ presets, selectedPresetId, onSave, onLoad, onDelete, onFactoryReset }: PresetPanelProps) {
  const [presetName, setPresetName] = useState('');

  const handleSave = () => {
    onSave(presetName);
    setPresetName('');
  };

  return (
    <section className="preset-section" aria-label="Presets">
      <div className="preset-panel tool-panel">
        <div className="panel-heading">
          <span>Presets</span>
          <strong>Saved in localStorage</strong>
        </div>
        <div className="preset-controls">
          <input
            type="text"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name"
            aria-label="Preset name"
          />
          <button type="button" onClick={handleSave}>
            Save
          </button>
          <select value={selectedPresetId ?? ''} onChange={(event) => onLoad(event.target.value)}>
            <option value="">Load preset</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => selectedPresetId && onDelete(selectedPresetId)} disabled={!selectedPresetId}>
            Delete
          </button>
          <button type="button" onClick={onFactoryReset}>
            Factory
          </button>
        </div>
        <div className="preset-list">
          {presets.slice(0, 3).map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={preset.id === selectedPresetId}
              onLoad={onLoad}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      <div className="next-panel tool-panel">
        <div className="panel-heading">
          <span>Version 2</span>
          <strong>Queued modules</strong>
        </div>
        <div className="module-tags">
          {['Chorus', 'Flanger', 'Phaser', 'Tremolo', 'Looper', 'Rhythm', 'Tap Tempo', 'MIDI EXP'].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <ImportExportPreset />
      </div>
    </section>
  );
}

export default PresetPanel;
