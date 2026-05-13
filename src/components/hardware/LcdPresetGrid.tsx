import { PedalboardPreset } from '../../store/presetStore';
import { StompPresetCategory } from './FootSwitchPanel';

type LcdPresetGridProps = {
  category: StompPresetCategory;
  presets: PedalboardPreset[];
  activePresetId: string | null;
  onLoadPreset: (preset: PedalboardPreset) => void;
  onClose: () => void;
};

function LcdPresetGrid({ category, presets, activePresetId, onLoadPreset, onClose }: LcdPresetGridProps) {
  return (
    <section className="lcd-preset-grid-view" aria-label={`${category} preset list`}>
      <header className="lcd-preset-grid-header">
        <div>
          <span>Preset Stomp Library</span>
          <strong>{category}</strong>
        </div>
        <button type="button" onClick={onClose}>
          Effect Board
        </button>
      </header>

      {presets.length ? (
        <div className="lcd-preset-card-grid">
          {presets.map((preset, index) => (
            <button
              key={preset.id}
              type="button"
              className={`lcd-preset-card ${preset.id === activePresetId ? 'is-active' : ''}`}
              onClick={() => onLoadPreset(preset)}
            >
              <span>
                {category.slice(0, 3).toUpperCase()}-{String(index + 1).padStart(3, '0')}
              </span>
              <strong>{preset.name}</strong>
              <small>{preset.origin.toUpperCase()}</small>
              <em>{preset.description || 'Ready to load this preset into the pedalboard.'}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className="lcd-preset-empty">
          <strong>No presets</strong>
          <span>Save a user preset to fill this switch bank.</span>
        </div>
      )}
    </section>
  );
}

export default LcdPresetGrid;
