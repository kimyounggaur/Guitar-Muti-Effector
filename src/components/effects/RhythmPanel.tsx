import { useEffect, useMemo, useState } from 'react';
import {
  RhythmPatternId,
  RhythmReading,
  emptyRhythmReading,
  getRhythmPatternName,
  subscribeRhythm,
} from '../../audio/nodes/RhythmNode';
import { Pedal, PedalParamValue } from '../../audio/types';
import { useTempoStore } from '../../store/tempoStore';

type RhythmParams = {
  bpm: number;
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
  const params = useMemo(() => readRhythmParams(pedal.params, tempoBpm), [pedal.params, tempoBpm]);
  const isPlaying = reading.isPlaying || params.playing;

  useEffect(() => subscribeRhythm(pedal.id, setReading), [pedal.id]);

  useEffect(() => {
    if (params.bpm !== tempoBpm) {
      onParamChange(pedal.id, 'bpm', tempoBpm);
    }
  }, [onParamChange, params.bpm, pedal.id, tempoBpm]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  const setBpm = (bpm: number) => {
    const nextBpm = setTempoBpm(bpm);
    setParam('bpm', nextBpm);
  };

  const handleTap = () => {
    const nextBpm = tapTempo();
    setParam('bpm', nextBpm);
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
        <button
          type="button"
          className="drag-handle"
          aria-label={`Move ${pedal.name}`}
          {...dragAttributes}
          {...dragListeners}
        >
          ≡
        </button>
        <button type="button" className="pedal-select rhythm-display" onClick={() => onSelect(pedal.id)}>
          <span>Practice rhythm</span>
          <strong>RHYTHM</strong>
          <em>{getRhythmPatternName(params.pattern)}</em>
        </button>
      </div>

      <div className="rhythm-readout">
        <div>
          <span>BPM</span>
          <strong>{Math.round(params.bpm)}</strong>
          <small>{isPlaying ? 'Playing' : tapCount > 1 ? 'Tap ready' : 'Stopped'}</small>
        </div>
        <div className="beat-leds" aria-label="Beat indicator">
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
        <button type="button" className={isPlaying ? 'is-playing' : ''} onClick={togglePlay}>
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>
        <button type="button" onClick={handleTap}>
          TAP
        </button>
      </div>

      <div className="rhythm-controls">
        <label className="rhythm-control">
          <span>BPM</span>
          <input
            type="number"
            min={40}
            max={240}
            value={Math.round(params.bpm)}
            onChange={(event) => setBpm(Number(event.target.value))}
          />
        </label>
        <label className="rhythm-control is-wide">
          <span>Pattern</span>
          <select value={params.pattern} onChange={(event) => setParam('pattern', event.target.value)}>
            <option value="metronome">Metronome 4/4</option>
            <option value="rock1">Rock 1</option>
            <option value="rock2">Rock 2</option>
            <option value="bluesShuffle">Blues Shuffle</option>
            <option value="funk">Funk</option>
            <option value="ballad">Ballad</option>
            <option value="sixEight">6/8</option>
            <option value="pop">Pop</option>
          </select>
        </label>
        <RhythmSlider label="Volume" value={params.volume} min={0} max={100} onChange={(value) => setParam('volume', value)} />
      </div>

      <div className="pedal-switches">
        <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={() => onToggle(pedal.id)}>
          {pedal.enabled ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className={pedal.bypassed ? 'is-bypassed' : ''}
          onClick={() => onBypass(pedal.id, !pedal.bypassed)}
        >
          {pedal.bypassed ? 'Bypassed' : 'Bypass'}
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
    <label className="rhythm-control">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{Math.round(value)}</strong>
    </label>
  );
}

const readRhythmParams = (params: Pedal['params'], tempoBpm: number): RhythmParams => ({
  bpm: readNumber(params.bpm, tempoBpm, 40, 240),
  pattern: readPattern(params.pattern),
  volume: readNumber(params.volume, 70, 0, 100),
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
