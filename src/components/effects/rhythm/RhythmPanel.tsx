import { useEffect, useMemo, useState } from 'react';
import {
  RhythmPatternId,
  RhythmReading,
  emptyRhythmReading,
  getRhythmPatternName,
  subscribeRhythm,
} from '../../../audio/nodes/RhythmNode';
import { Pedal, PedalParamValue } from '../../../audio/types';
import { useTempoStore } from '../../../store/tempoStore';
import { PEDAL_SCHEMAS, TEMPO } from '../../../audio/params/schema';
import { useAudioStore } from '../../../store/audioStore';
import KnobControl from '../../controls/KnobControl';
import '../../../styles/components/rhythm.css';
import { t } from '../../../i18n/ko';

const S = PEDAL_SCHEMAS.rhythm;

type RhythmParams = {
  pattern: RhythmPatternId;
  volume: number;
  playing: boolean;
};

type RhythmPanelProps = {
  pedal: Pedal;
  selected: boolean;
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  isDragging?: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onBypass: (id: string, bypassed: boolean) => void;
  onParamChange: (id: string, paramName: string, value: PedalParamValue) => void;
};

function RhythmPanel({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: RhythmPanelProps) {
  const tempoBpm = useTempoStore((state) => state.bpm);
  const tapCount = useTempoStore((state) => state.tapCount);
  const setTempoBpm = useTempoStore((state) => state.setBpm);
  const tapTempo = useTempoStore((state) => state.tapTempo);
  const [reading, setReading] = useState<RhythmReading>(emptyRhythmReading);
  const audioReady = useAudioStore((state) => state.isAudioReady);
  const params = useMemo(() => readRhythmParams(pedal.params), [pedal.params]);
  const isPlaying = audioReady && reading.isPlaying;

  useEffect(() => subscribeRhythm(pedal.id, setReading), [pedal.id]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  // Tempo lives only in tempoStore; the engine forwards it to the rhythm node (design §3.2).
  const setBpm = (bpm: number) => {
    setTempoBpm(bpm);
  };

  const handleTap = () => {
    tapTempo();
  };

  const togglePlay = () => {
    setParam('playing', !isPlaying);
  };

  return (
    <article
      className={`pedal-card rhythm-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
        isDragging ? 'is-dragging' : ''
      }`}
    >
      <div className="pedal-top">
        {dragListeners ? (<button
          type="button"
          className="drag-handle"
          aria-label={t('panel.detail.move', { name: pedal.name })}
          {...dragAttributes}
          {...dragListeners}
        >
          ≡
        </button>) : null}
        <button type="button" className="pedal-select rhythm-display" onClick={() => onSelect(pedal.id)}>
          <span>{t('panel.rhythm.title')}</span>
          <strong>{t('panel.rhythm.lettering')}</strong>
          <em>{getRhythmPatternName(params.pattern)}</em>
        </button>
      </div>

      <div className="rhythm-readout">
        <div>
          <span>BPM</span>
          <strong>{Math.round(tempoBpm)}</strong>
          <small>{isPlaying ? t('panel.rhythm.playing') : tapCount > 1 ? t('panel.rhythm.tapped') : t('panel.common.stop')}</small>
        </div>
        <div className="beat-leds" aria-label={t('panel.rhythm.beats')}>
          {Array.from({ length: reading.beatCount || 4 }).map((_, index) => (
            <i
              key={index}
              className={isPlaying && index === reading.beatIndex ? 'is-active' : ''}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      <div className="rhythm-step-strip">
        {Array.from({ length: reading.stepCount || 16 }).map((_, index) => (
          <i key={index} className={isPlaying && index === reading.currentStep ? 'is-active' : ''} aria-hidden="true" />
        ))}
      </div>

      <div className="rhythm-transport">
        <button type="button" className={isPlaying ? 'is-playing' : ''} onClick={togglePlay} disabled={!audioReady || !pedal.enabled || pedal.bypassed}>
          {isPlaying ? t('panel.common.stop') : t('panel.common.play')}
        </button>
        <button type="button" onClick={handleTap}>
          TAP
        </button>
      </div>

      {!audioReady ? <p role="status">{t('panel.rhythm.connectHint')}</p> : !pedal.enabled || pedal.bypassed ? <p role="status">{t('panel.rhythm.enableHint')}</p> : null}
      <div className="rhythm-controls">
        <label className="rhythm-control">
          <span>BPM</span>
          <input
            type="number"
            min={TEMPO.min}
            max={TEMPO.max}
            value={Math.round(tempoBpm)}
            onChange={(event) => setBpm(Number(event.target.value))}
          />
        </label>
        <label className="rhythm-control is-wide">
          <span>{t('param.rhythm.pattern')}</span>
          <select value={params.pattern} onChange={(event) => setParam('pattern', event.target.value)}>
            <option value="metronome">{t('panel.rhythm.metronome')}</option>
            <option value="rock1">{t('panel.rhythm.rock1')}</option>
            <option value="rock2">{t('panel.rhythm.rock2')}</option>
            <option value="bluesShuffle">{t('panel.rhythm.bluesShuffle')}</option>
            <option value="funk">{t('panel.rhythm.funk')}</option>
            <option value="ballad">{t('panel.rhythm.ballad')}</option>
            <option value="sixEight">6/8</option>
            <option value="pop">{t('panel.rhythm.pop')}</option>
          </select>
        </label>
        <RhythmSlider label={t('panel.rhythm.volume')} value={params.volume} min={S.volume.min} max={S.volume.max} onChange={(value) => setParam('volume', value)} />
      </div>

      <div className="pedal-switches">
        <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={() => onToggle(pedal.id)}>
          {pedal.enabled ? t('panel.common.on') : t('panel.common.off')}
        </button>
        <button
          type="button"
          className={pedal.bypassed ? 'is-bypassed' : ''}
          onClick={() => onBypass(pedal.id, !pedal.bypassed)}
        >
          {pedal.bypassed ? t('panel.common.unbypass') : t('panel.common.bypass')}
        </button>
      </div>
    </article>
  );
}

type RhythmSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function RhythmSlider({ label, value, min, max, onChange }: RhythmSliderProps) {
  return (
    <KnobControl className="rhythm-control" label={label} value={value} min={min} max={max} step={1} onChange={onChange} />
  );
}

const readRhythmParams = (params: Pedal['params']): RhythmParams => ({
  pattern: readPattern(params.pattern),
  volume: readNumber(params.volume, S.volume.default, S.volume.min, S.volume.max),
  playing: params.playing === true,
});

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const readPattern = (value: PedalParamValue | undefined): RhythmPatternId => {
  if (
    value === 'metronome' ||
    value === 'rock1' ||
    value === 'rock2' ||
    value === 'bluesShuffle' ||
    value === 'funk' ||
    value === 'ballad' ||
    value === 'sixEight' ||
    value === 'pop'
  ) {
    return value;
  }

  return 'metronome';
};

export default RhythmPanel;
