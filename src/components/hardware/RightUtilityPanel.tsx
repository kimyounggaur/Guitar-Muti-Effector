import KnobControl from '../controls/KnobControl';
import '../../styles/components/right-panel.css';
import { t } from '../../i18n/ko';

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
    <section className="right-utility-panel" aria-label={t('panel.utility.region')}>
      <div className="utility-readout">
        <span>{t('panel.utility.pedal')}</span>
        <strong>{selectedPedalName}</strong>
      </div>
      <div className="tempo-readout">
        <span>{t('panel.utility.tempo')}</span>
        <strong>{Math.round(bpm)}</strong>
        <small>{tapCount > 1 ? `${tapCount}회 탭` : 'BPM'}</small>
      </div>
      <div className="master-volume-readout">
        <span>{t('panel.utility.master')}</span>
        <KnobControl
          className="master-utility-knob"
          label="음량"
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
        
        {t('panel.utility.openTuner')}
      </button>
    </section>
  );
}

export default RightUtilityPanel;
