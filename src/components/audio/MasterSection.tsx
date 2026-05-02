import SliderControl from '../controls/SliderControl';
import InputMeter from './InputMeter';
import OutputMeter from './OutputMeter';
import { MeterReading } from '../../audio/types';

type MasterSectionProps = {
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
};

function MasterSection({ inputMeter, outputMeter, masterVolume, onMasterVolumeChange }: MasterSectionProps) {
  return (
    <div className="meter-panel tool-panel">
      <div className="panel-heading">
        <span>Meters</span>
        <strong>Input and output</strong>
      </div>
      <InputMeter meter={inputMeter} />
      <OutputMeter meter={outputMeter} />
      <SliderControl
        label="Master"
        min={0}
        max={1.25}
        step={0.01}
        value={masterVolume}
        output={`${Math.round(masterVolume * 100)}%`}
        className="master-row"
        onChange={onMasterVolumeChange}
      />
    </div>
  );
}

export default MasterSection;
