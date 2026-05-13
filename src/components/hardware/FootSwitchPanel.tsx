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

type FootSwitchPanelProps = {
  categories?: readonly StompPresetCategory[];
  activeCategory: StompPresetCategory | null;
  categoryCounts: Record<string, number>;
  onCategorySelected: (category: StompPresetCategory) => void;
};

function FootSwitchPanel({
  categories = STOMP_PRESET_CATEGORIES,
  activeCategory,
  categoryCounts,
  onCategorySelected,
}: FootSwitchPanelProps) {
  return (
    <section className="foot-switch-panel preset-stomp-panel" aria-label="Preset stomp switches">
      {categories.map((category, index) => {
        const active = activeCategory === category;
        const switchLabel = getSwitchLabel(index);

        return (
          <button
            key={category}
            type="button"
            className={`hardware-footswitch stomp-category-switch ${active ? 'is-on is-selected' : ''}`}
            onClick={() => onCategorySelected(category)}
            aria-pressed={active}
          >
            <span className="stomp-label-strip">
              <b>{switchLabel}</b>
              <em>{category}</em>
            </span>
            <span className="footswitch-led" aria-hidden="true" />
            <strong>{category}</strong>
            <small>{categoryCounts[category] ?? 0} presets</small>
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
