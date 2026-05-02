import { MeterReading } from '../../audio/nodes/MeterNode';
import InputMeter from './InputMeter';
import OutputMeter from './OutputMeter';

type MasterSectionProps = {
  masterVolume: number;
  isAudioReady: boolean;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  onMasterVolumeChange: (volume: number) => void;
  onPanic: () => void;
};

function MasterSection({
  masterVolume,
  isAudioReady,
  inputMeter,
  outputMeter,
  onMasterVolumeChange,
  onPanic,
}: MasterSectionProps) {
  return (
    <section className="master-section" aria-label="Master controls">
      <div className="panel-heading">
        <span>Master</span>
        <strong>{isAudioReady ? 'Live monitor active' : 'Waiting for guitar input'}</strong>
      </div>
      <div className="master-grid">
        <InputMeter meter={inputMeter} />
        <OutputMeter meter={outputMeter} />
        <div className="volume-shell">
          <span>Master Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(event) => onMasterVolumeChange(Number(event.target.value))}
            aria-label="Master volume"
          />
          <strong>{Math.round(masterVolume * 100)}%</strong>
        </div>
        <button type="button" className="panic-button" onClick={onPanic}>
          Panic
        </button>
      </div>
    </section>
  );
}

export default MasterSection;
