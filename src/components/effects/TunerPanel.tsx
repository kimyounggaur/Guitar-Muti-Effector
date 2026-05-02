import { TunerReading } from '../../audio/types';
import { clamp } from '../../audio/utils/curves';
import MiniDisplay from '../controls/MiniDisplay';

type TunerPanelProps = {
  tuner: TunerReading;
  connected: boolean;
};

function TunerPanel({ tuner, connected }: TunerPanelProps) {
  const cents = clamp(tuner.cents, -50, 50);
  const needleLeft = ((cents + 50) / 100) * 100;
  const tuned = tuner.frequency !== null && Math.abs(tuner.cents) <= 5;

  return (
    <div className="tuner-panel tool-panel">
      <div className="panel-heading">
        <span>Tuner</span>
        <strong>{connected ? 'Input pitch' : 'Waiting for input'}</strong>
      </div>
      <MiniDisplay
        eyebrow="Note"
        value={tuner.note}
        subValue={tuner.frequency ? `${tuner.frequency.toFixed(1)} Hz` : 'No pitch'}
        tuned={tuned}
      />
      <div className="tuner-scale" aria-label="Tuning cents">
        <span>-50</span>
        <span>0</span>
        <span>+50</span>
        <i style={{ left: `${needleLeft}%` }} />
      </div>
      <div className="tuner-readout">
        <span>{tuner.frequency ? `${tuner.cents > 0 ? '+' : ''}${tuner.cents} cents` : 'Play a single note'}</span>
        <span>{Math.round(tuner.confidence * 100)}%</span>
      </div>
    </div>
  );
}

export default TunerPanel;
