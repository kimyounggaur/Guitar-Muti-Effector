import { useEffect, useState } from 'react';
import { MeterReading } from '../../audio/nodes/MeterNode';

type LevelMeterProps = {
  label: string;
  meter: MeterReading;
};

const formatDb = (db: number) => `${Math.round(db)} dBFS`;

function LevelMeter({ label, meter }: LevelMeterProps) {
  const [clipUntil, setClipUntil] = useState(0);
  const [peakHold, setPeakHold] = useState(-60);

  useEffect(() => {
    if (meter.isClipping) {
      setClipUntil(performance.now() + 900);
    }

    setPeakHold((current) => Math.max(meter.peakDb, current - 0.7));
  }, [meter.isClipping, meter.peakDb]);

  const isClipHeld = clipUntil > performance.now();
  const peakPercent = Math.min(100, Math.max(0, ((peakHold + 60) / 60) * 100));

  return (
    <div className={`level-meter ${meter.isClipping || isClipHeld ? 'is-clipping' : meter.isWarning ? 'is-warning' : ''}`}>
      <div className="meter-header">
        <span>{label}</span>
        <strong>{formatDb(meter.rmsDb)}</strong>
      </div>
      <div className="meter-bar" aria-label={`${label} meter`}>
        <i className="meter-fill" style={{ transform: `scaleX(${meter.level})` }} />
        <i className="peak-hold" style={{ left: `${peakPercent}%` }} />
      </div>
      <div className="meter-footer">
        <span>{meter.isLow ? 'Signal Low' : `Peak ${formatDb(meter.peakDb)}`}</span>
        <strong className={isClipHeld ? 'clip-label is-on' : 'clip-label'}>CLIP</strong>
      </div>
    </div>
  );
}

export default LevelMeter;
