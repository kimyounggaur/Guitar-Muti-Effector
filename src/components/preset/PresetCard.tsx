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
  const isFactory = preset.origin === 'factory';

  const handleRename = () => {
    onRename(preset.id, name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`프리셋 "${preset.name}"을 삭제하시겠습니까?`);
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
            aria-label="프리셋 이름"
          />
        ) : (
          <button type="button" className="preset-title-button" onClick={() => onLoad(preset)}>
            <strong>{preset.name}</strong>
            <span>
              {preset.category.toUpperCase()} / {preset.origin.toUpperCase()}
            </span>
          </button>
        )}
        <small>{preset.description || `${preset.pedals.length}개 페달 · ${preset.tempoBpm} BPM`}</small>
      </div>

      <div className="preset-actions">
        <button type="button" onClick={() => onLoad(preset)}>
          불러오기
        </button>
        {isEditing ? (
          <button type="button" onClick={handleRename}>
            저장
          </button>
        ) : (
          <button type="button" disabled={isFactory} title={isFactory ? '공장 프리셋은 복사 후 이름을 변경할 수 있습니다.' : undefined} onClick={() => setIsEditing(true)}>
            이름 변경
          </button>
        )}
        <button type="button" onClick={() => onDuplicate(preset.id)}>
          복사
        </button>
        <button type="button" className="is-danger" onClick={handleDelete} disabled={isFactory}>
          삭제
        </button>
      </div>
    </article>
  );
}

export default PresetCard;
