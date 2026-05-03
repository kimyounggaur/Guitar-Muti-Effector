import KnobControl from '../controls/KnobControl';

type RightUtilityPanelProps = {
  bpm: number;
  tapCount: number;
  masterVolume: number;
  selectedPedalName: string;
  onMasterVolumeChange: (volume: number) => void;
  onTapTempo: () => void;
  onTuner: () => void;
};

function RightUtilityPanel({
  bpm,
  tapCount,
  masterVolume,
  selectedPedalName,
  onMasterVolumeChange,
  onTapTempo,
  onTuner,
}: RightUtilityPanelProps) {
  return (
    <section className="right-utility-panel" aria-label="Tempo and tuner utilities">
      <div className="utility-readout">
        <span>PEDAL</span>
        <strong>{selectedPedalName}</strong>
      </div>
      <div className="tempo-readout">
        <span>TEMPO</span>
        <strong>{Math.round(bpm)}</strong>
        <small>{tapCount > 1 ? `${tapCount} taps` : 'BPM'}</small>
      </div>
      <div className="master-volume-readout">
        <span>MASTER</span>
        <KnobControl
          className="master-utility-knob"
          label="Volume"
          value={Math.round(masterVolume * 100)}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(value) => onMasterVolumeChange(value / 100)}
        />
      </div>
      <button type="button" className="tap-button" onClick={onTapTempo}>
        TAP
      </button>
      <button type="button" className="tuner-hold-button" onClick={onTuner}>
        HOLD TO TUNER
      </button>
    </section>
  );
}

export default RightUtilityPanel;
