type RightUtilityPanelProps = {
  bpm: number;
  tapCount: number;
  selectedPedalName: string;
  onTapTempo: () => void;
  onTuner: () => void;
};

function RightUtilityPanel({ bpm, tapCount, selectedPedalName, onTapTempo, onTuner }: RightUtilityPanelProps) {
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
