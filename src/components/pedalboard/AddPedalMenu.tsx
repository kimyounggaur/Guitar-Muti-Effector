import { EFFECT_DEFINITIONS } from '../../audio/types';

function AddPedalMenu() {
  return (
    <div className="add-pedal-menu" aria-label="Available pedals">
      {EFFECT_DEFINITIONS.map((definition) => (
        <span key={definition.type} style={{ '--pedal-accent': definition.accent } as React.CSSProperties}>
          {definition.shortLabel}
        </span>
      ))}
    </div>
  );
}

export default AddPedalMenu;
