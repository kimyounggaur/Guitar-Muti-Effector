import { Preset } from '../../audio/types';

type PresetCardProps = {
  preset: Preset;
  selected: boolean;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
};

function PresetCard({ preset, selected, onLoad, onDelete }: PresetCardProps) {
  return (
    <article className={selected ? 'preset-card is-selected' : 'preset-card'}>
      <button type="button" onClick={() => onLoad(preset.id)}>
        <strong>{preset.name}</strong>
        <span>{new Date(preset.createdAt).toLocaleDateString()}</span>
      </button>
      <button type="button" onClick={() => onDelete(preset.id)} aria-label={`Delete ${preset.name}`}>
        Delete
      </button>
    </article>
  );
}

export default PresetCard;
