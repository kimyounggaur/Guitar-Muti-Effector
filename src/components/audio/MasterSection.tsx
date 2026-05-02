type MasterSectionProps = {
  masterVolume: number;
  isAudioReady: boolean;
  onMasterVolumeChange: (volume: number) => void;
  onPanic: () => void;
};

function MasterSection({ masterVolume, isAudioReady, onMasterVolumeChange, onPanic }: MasterSectionProps) {
  return (
    <section className="master-section" aria-label="Master controls">
      <div className="panel-heading">
        <span>Master</span>
        <strong>{isAudioReady ? 'Live monitor active' : 'Waiting for guitar input'}</strong>
      </div>
      <div className="master-grid">
        <div className="meter-shell">
          <span>Input</span>
          <i />
        </div>
        <div className="meter-shell">
          <span>Output</span>
          <i />
        </div>
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
