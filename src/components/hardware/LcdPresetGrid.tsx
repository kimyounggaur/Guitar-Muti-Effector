import { PedalboardPreset } from '../../store/presetStore';
import { StompPresetCategory } from './FootSwitchPanel';
import { formatCategory, t, tDynamic } from '../../i18n/ko';

type LcdPresetGridProps = {
  category: StompPresetCategory;
  presets: PedalboardPreset[];
  activePresetId: string | null;
  onLoadPreset: (preset: PedalboardPreset) => void;
  onClose: () => void;
};

function LcdPresetGrid({ category, presets, activePresetId, onLoadPreset, onClose }: LcdPresetGridProps) {
  return (
    <section className="lcd-preset-grid-view" aria-label={t('panel.lcdPresets.region', { category: formatCategory(category) })}>
      <header className="lcd-preset-grid-header">
        <div>
          <span>{t('panel.lcdPresets.title')}</span>
          <strong>{formatCategory(category)}</strong>
        </div>
        <button type="button" onClick={onClose}>
          
          {t('panel.lcdPresets.board')}
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
              <small>{tDynamic(`preset.origin.${preset.origin}`, preset.origin)}</small>
              <em>{preset.description || t('panel.lcdPresets.defaultDescription')}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className="lcd-preset-empty">
          <strong>{t('panel.lcdPresets.empty')}</strong>
          <span>{t('panel.lcdPresets.emptyHint')}</span>
        </div>
      )}
    </section>
  );
}

export default LcdPresetGrid;
