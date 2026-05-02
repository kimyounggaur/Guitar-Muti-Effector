import LevelMeter from './LevelMeter';
import { MeterReading } from '../../audio/nodes/MeterNode';

type OutputMeterProps = {
  meter: MeterReading;
};

function OutputMeter({ meter }: OutputMeterProps) {
  return <LevelMeter label="Output" meter={meter} />;
}

export default OutputMeter;
