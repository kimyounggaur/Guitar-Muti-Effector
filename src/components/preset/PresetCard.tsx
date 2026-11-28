import { useState } from 'react';
import { PedalboardPreset } from '../../store/presetStore';
import { formatCategory, t, tDynamic } from '../../i18n/ko';

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
  const isFactory = preset.origin === 'factory';

  const handleRename = () => {
    onRename(preset.id, name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(t('confirm.deletePreset', { name: preset.name }));
    if (confirmed) {
      onDelete(preset.id);
    }
  };

  return (
    <article className={`preset-card preset-library-row ${active ? 'is-active' : ''}`}>
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
            aria-label={t('panel.preset.name')}
          />
        ) : (
          <button type="button" className="preset-title-button" onClick={() => onLoad(preset)}>
            <strong>{preset.name}</strong>
            <span>
              {formatCategory(preset.category)} / {tDynamic(`preset.origin.${preset.origin}`, preset.origin)}
            </span>
          </button>
        )}
        <small>{preset.description || t('panel.preset.signalChain', { count: preset.pedals.length, bpm: preset.tempoBpm })}</small>
      </div>

      <div className="preset-actions">
        <button type="button" onClick={() => onLoad(preset)}>
          
          {t('panel.preset.load')}
        </button>
        {isEditing ? (
          <button type="button" onClick={handleRename}>
            
            {t('panel.preset.save')}
          </button>
        ) : (
          <button type="button" disabled={isFactory} title={isFactory ? t('panel.preset.copyToRename') : undefined} onClick={() => setIsEditing(true)}>
            
            {t('panel.preset.rename')}
          </button>
        )}
        <button type="button" onClick={() => onDuplicate(preset.id)}>
          
          {t('panel.preset.duplicate')}
        </button>
        <button type="button" className="is-danger" onClick={handleDelete} disabled={isFactory}>
          
          {t('panel.preset.delete')}
        </button>
      </div>
    </article>
  );
}

export default PresetCard;
