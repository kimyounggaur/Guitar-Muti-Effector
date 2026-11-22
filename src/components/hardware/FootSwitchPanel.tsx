import type { Pedal } from '../../audio/types';
import '../../styles/components/footswitch.css';
import { t } from '../../i18n/ko';

export const STOMP_PRESET_CATEGORIES = [
  'Clean',
  'Bass',
  'Lead',
  'Crunch',
  'High Gain',
  'Ambient',
  'Modulation',
  'FX',
  'Experimental',
  'User Presets',
] as const;

export type StompPresetCategory = (typeof STOMP_PRESET_CATEGORIES)[number];
export type StompSwitchMode = 'effects' | 'presets';

type FootSwitchPanelProps = {
  categories?: readonly StompPresetCategory[];
  mode: StompSwitchMode;
  activeCategory: StompPresetCategory | null;
  categoryCounts: Record<string, number>;
  effectPedals: Pedal[];
  selectedPedalId: string | null;
  onModeChanged: (mode: StompSwitchMode) => void;
  onCategorySelected: (category: StompPresetCategory) => void;
  onEffectPedalToggled: (pedalId: string) => void;
};

function FootSwitchPanel({
  categories = STOMP_PRESET_CATEGORIES,
  mode,
  activeCategory,
  categoryCounts,
  effectPedals,
  selectedPedalId,
  onModeChanged,
  onCategorySelected,
  onEffectPedalToggled,
}: FootSwitchPanelProps) {
  const switchCount = Math.max(categories.length, effectPedals.length);

  return (
    <section className={`foot-switch-panel preset-stomp-panel is-${mode}-mode`} aria-label={t('panel.footswitch.region')}>
      <div className="stomp-mode-toggle-row" aria-label={t('panel.footswitch.mode')}>
        <button
          type="button"
          className={mode === 'effects' ? 'is-active' : ''}
          onClick={() => onModeChanged('effects')}
          aria-pressed={mode === 'effects'}
        >
          
          {t('panel.footswitch.effects')}
        </button>
        <button
          type="button"
          className={mode === 'presets' ? 'is-active' : ''}
          onClick={() => onModeChanged('presets')}
          aria-pressed={mode === 'presets'}
        >
          
          {t('panel.footswitch.presets')}
        </button>
      </div>

      {Array.from({ length: switchCount }).map((_, index) => {
        const category = categories[index];
        const pedal = effectPedals[index];
        const isEffectMode = mode === 'effects';
        const switchName = isEffectMode ? pedal?.name ?? 'EMPTY' : category ?? 'EMPTY';
        const active = isEffectMode ? Boolean(pedal?.enabled && !pedal.bypassed) : activeCategory === category;
        const selected = isEffectMode ? selectedPedalId === pedal?.id : active;
        const switchLabel = getSwitchLabel(index);
        const statusText = isEffectMode
          ? pedal
            ? pedal.enabled
              ? pedal.bypassed
                ? '바이패스'
                : '켜짐'
              : '꺼짐'
            : '할당 없음'
          : `${categoryCounts[category] ?? 0}개 프리셋`;
        const handleClick = () => {
          if (isEffectMode) {
            if (pedal) {
              onEffectPedalToggled(pedal.id);
            }
            return;
          }

          if (category) {
            onCategorySelected(category);
          }
        };

        return (
          <button
            key={isEffectMode ? pedal?.id ?? `effect-empty-${index}` : category ?? `preset-empty-${index}`}
            type="button"
            className={`hardware-footswitch stomp-category-switch ${active ? 'is-on' : ''} ${
              selected ? 'is-selected' : ''
            } ${isEffectMode ? 'is-effect-assigned' : ''}`}
            onClick={handleClick}
            aria-pressed={active}
            disabled={isEffectMode ? !pedal : !category}
          >
            <span className="stomp-label-strip">
              <b>{switchLabel}</b>
              <em title={switchName}>{shortSwitchName(switchName)}</em>
            </span>
            <span className="footswitch-led" aria-hidden="true" />
            <strong>{switchName}</strong>
            <small>{statusText}</small>
          </button>
        );
      })}
    </section>
  );
}

const getSwitchLabel = (index: number) => {
  const bank = index < 5 ? 'A' : 'B';
  const slot = (index % 5) + 1;
  return `${bank}${slot}`;
};

export default FootSwitchPanel;

// The label strip fits about eight capital letters at 12px; longer names use a short form (full name in title).
const SHORT_SWITCH_NAMES: Record<string, string> = {
  Modulation: 'MOD',
  Experimental: 'EXP',
  'User Presets': 'USER',
  'High Gain': 'HI-GAIN',
  'Noise Gate': 'GATE',
  Compressor: 'COMP',
  'Cabinet IR': 'CAB IR',
};
const shortSwitchName = (name: string) => SHORT_SWITCH_NAMES[name] ?? (name.length > 8 ? name.slice(0, 6) : name);

