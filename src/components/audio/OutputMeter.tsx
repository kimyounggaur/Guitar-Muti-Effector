import { MeterReading } from '../../audio/types';
import { clamp } from '../../audio/utils/curves';
import { formatDb, meterDbToPercent } from '../../audio/utils/db';

type OutputMeterProps = {
  meter: MeterReading;
};

function OutputMeter({ meter }: OutputMeterProps) {
  const level = meterDbToPercent(meter.db);
  const peak = clamp(meter.peak, 0, 1);

  return (
    <div className="level-meter">
      <div className="meter-label">
        <span>Output</span>
        <output>{formatDb(meter.db)}</output>
      </div>
      <div className="meter-track">
        <span className="meter-fill" style={{ transform: `scaleX(${level})` }} />
        <span className="meter-peak" style={{ left: `${peak * 100}%` }} />
      </div>
    </div>
  );
}

export default OutputMeter;
