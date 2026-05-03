import { Pedal } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';

type FootSwitchPanelProps = {
  pedals: Pedal[];
  selectedPedalId: string | null;
  onPedalToggled?: (pedals: Pedal[]) => void;
};

function FootSwitchPanel({ pedals, selectedPedalId, onPedalToggled }: FootSwitchPanelProps) {
  const togglePedal = usePedalStore((state) => state.togglePedal);
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const footPedals = getFootPedals(pedals);

  const handleSwitch = (pedal: Pedal) => {
    setSelectedPedal(pedal.id);
    togglePedal(pedal.id);
    window.requestAnimationFrame(() => onPedalToggled?.(usePedalStore.getState().pedals));
  };

  return (
    <section className="foot-switch-panel" aria-label="Footswitches">
      {footPedals.map((pedal, index) => (
        <button
          key={pedal.id}
          type="button"
          className={`hardware-footswitch ${pedal.enabled ? 'is-on' : ''} ${
            selectedPedalId === pedal.id ? 'is-selected' : ''
          }`}
          onClick={() => handleSwitch(pedal)}
        >
          <span className="footswitch-led" aria-hidden="true" />
          <strong>{pedal.name}</strong>
          <small>EFFECT-{index + 1}</small>
        </button>
      ))}
    </section>
  );
}

const preferredFootIds = ['compressor', 'drive', 'delay', 'reverb'];

const getFootPedals = (pedals: Pedal[]) => {
  const preferred = preferredFootIds
    .map((id) => pedals.find((pedal) => pedal.id === id))
    .filter(Boolean) as Pedal[];
  const usedIds = new Set(preferred.map((pedal) => pedal.id));
  const fallback = pedals.filter((pedal) => !usedIds.has(pedal.id) && pedal.type !== 'tuner');
  return [...preferred, ...fallback].slice(0, 4);
};

export default FootSwitchPanel;
