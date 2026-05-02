import LevelMeter from './LevelMeter';
import { MeterReading } from '../../audio/nodes/MeterNode';

type InputMeterProps = {
  meter: MeterReading;
};

function InputMeter({ meter }: InputMeterProps) {
  return <LevelMeter label="Input" meter={meter} />;
}

export default InputMeter;
