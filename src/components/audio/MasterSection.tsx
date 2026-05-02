import { MeterReading } from '../../audio/nodes/MeterNode';
import KnobControl from '../controls/KnobControl';
import InputMeter from './InputMeter';
import OutputMeter from './OutputMeter';

type MasterSectionProps = {
  masterVolume: number;
  isAudioReady: boolean;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  onMasterVolumeChange: (volume: number) => void;
  onPanic: () => void;
  onTunerQuick?: () => void;
};

function MasterSection({
  masterVolume,
  isAudioReady,
  inputMeter,
  outputMeter,
  onMasterVolumeChange,
  onPanic,
  onTunerQuick,
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
          <KnobControl
            className="master-volume-knob"
            label="Master Volume"
            value={masterVolume}
            min={0}
            max={1}
            step={0.01}
            formatValue={(nextValue) => `${Math.round(nextValue * 100)}%`}
            onChange={onMasterVolumeChange}
          />
        </div>
        <button type="button" className="panic-button" onClick={onPanic}>
          Panic
        </button>
        <button type="button" className="tuner-quick-button" onClick={onTunerQuick}>
          Tuner
        </button>
      </div>
    </section>
  );
}

export default MasterSection;
