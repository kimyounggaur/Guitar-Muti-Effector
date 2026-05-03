import { MeterReading } from '../../audio/nodes/MeterNode';

type PatchHeaderProps = {
  bank: string;
  patch: string;
  patchName: string;
  bpm: number;
  isAudioReady: boolean;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
};

function PatchHeader({ bank, patch, patchName, bpm, isAudioReady, inputMeter, outputMeter }: PatchHeaderProps) {
  return (
    <header className="patch-header">
      <div className="patch-identity">
        <span>
          {bank}-{patch}
        </span>
        <strong>{patchName}</strong>
      </div>
      <div className="patch-meters" aria-label="Input and output status">
        <MeterPill label="IN" valueDb={inputMeter.rmsDb} />
        <MeterPill label="OUT" valueDb={outputMeter.rmsDb} />
        <span className={isAudioReady ? 'screen-led is-live' : 'screen-led'}>{isAudioReady ? 'LIVE' : 'IDLE'}</span>
        <span className="screen-bpm">{Math.round(bpm)} BPM</span>
      </div>
    </header>
  );
}

function MeterPill({ label, valueDb }: { label: string; valueDb: number }) {
  const fill = Math.min(100, Math.max(0, ((valueDb + 60) / 60) * 100));

  return (
    <span className="screen-meter-pill">
      <b>{label}</b>
      <i style={{ width: `${fill}%` }} />
    </span>
  );
}

export default PatchHeader;
