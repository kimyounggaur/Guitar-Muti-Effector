import { useState } from 'react';
import { PedalboardPreset } from '../../store/presetStore';

type PresetCardProps = {
  preset: PedalboardPreset;
  active: boolean;
  onLoad: (preset: PedalboardPreset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

function PresetCard({ preset, active, onLoad, onRename, onDelete, onDuplicate }: PresetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(preset.name);

  const handleRename = () => {
    onRename(preset.id, name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete preset "${preset.name}"?`);
    if (confirmed) {
      onDelete(preset.id);
    }
  };

  return (
    <article className={`preset-card ${active ? 'is-active' : ''}`}>
      <div className="preset-card-main">
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleRename();
              }

              if (event.key === 'Escape') {
                setName(preset.name);
                setIsEditing(false);
              }
            }}
            aria-label="Preset name"
          />
        ) : (
          <button type="button" className="preset-title-button" onClick={() => onLoad(preset)}>
            <span>{active ? 'Current preset' : 'Preset'}</span>
            <strong>{preset.name}</strong>
          </button>
        )}
        <small>
          {preset.pedals.length} pedals · {Math.round(preset.masterVolume * 100)}% master · {preset.tempoBpm} BPM
        </small>
      </div>

      <div className="preset-actions">
        <button type="button" onClick={() => onLoad(preset)}>
          Load
        </button>
        {isEditing ? (
          <button type="button" onClick={handleRename}>
            Save
          </button>
        ) : (
          <button type="button" onClick={() => setIsEditing(true)}>
            Rename
          </button>
        )}
        <button type="button" onClick={() => onDuplicate(preset.id)}>
          Duplicate
        </button>
        <button type="button" className="is-danger" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default PresetCard;
