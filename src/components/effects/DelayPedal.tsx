import { useMemo } from 'react';
import { bpmToDelayTimeMs } from '../../audio/nodes/DelayEffect';
import { Pedal, PedalParamValue } from '../../audio/types';
import { useTempoStore } from '../../store/tempoStore';
import KnobControl from '../controls/KnobControl';

type DelayMode = 'digital' | 'analog' | 'tape' | 'slapback' | 'pingpong';
type DelayDivision = '1/4' | '1/8' | 'dotted1/8' | '1/16';

type DelayParams = {
  mode: DelayMode;
  timeMs: number;
  feedback: number;
  mix: number;
  tone: number;
  sync: boolean;
  bpm: number;
  division: DelayDivision;
  flutter: number;
};

type DelayPedalProps = {
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

function DelayPedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: DelayPedalProps) {
  const tempoBpm = useTempoStore((state) => state.bpm);
  const setTempoBpm = useTempoStore((state) => state.setBpm);
  const tapTempo = useTempoStore((state) => state.tapTempo);
  const params = useMemo(() => readDelayParams(pedal.params, tempoBpm), [pedal.params, tempoBpm]);
  const effectiveTimeMs = params.sync ? bpmToDelayTimeMs(params.bpm, params.division) : clampDelayTime(params.timeMs, params.mode);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  const setBpm = (bpm: number) => {
    const nextBpm = setTempoBpm(bpm);
    setParam('bpm', nextBpm);
  };

  const handleTapTempo = () => {
    const nextBpm = tapTempo();
    setParam('sync', true);
    setParam('bpm', nextBpm);
  };

  return (
    <article
      className={`pedal-card delay-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select delay-display" onClick={() => onSelect(pedal.id)}>
          <span>Echo engine</span>
          <strong>DELAY</strong>
          <em>
            {formatMode(params.mode)} / {Math.round(effectiveTimeMs)}ms
          </em>
        </button>
      </div>

      <div className="delay-time-display">
        <span>{params.sync ? params.division : 'Free'}</span>
        <strong>{Math.round(effectiveTimeMs)} ms</strong>
        <i style={{ width: `${Math.min(100, (effectiveTimeMs / 2000) * 100)}%` }} />
      </div>

      <div className="delay-row">
        <label className="delay-control is-wide">
          <span>Mode</span>
          <select value={params.mode} onChange={(event) => setParam('mode', event.target.value)}>
            <option value="digital">Digital</option>
            <option value="analog">Analog</option>
            <option value="tape">Tape</option>
            <option value="slapback">Slapback</option>
            <option value="pingpong">Pingpong</option>
          </select>
        </label>
        <label className="delay-sync-toggle">
          <span>Sync</span>
          <input type="checkbox" checked={params.sync} onChange={(event) => setParam('sync', event.target.checked)} />
        </label>
      </div>

      <div className="delay-controls">
        <DelaySlider
          label="Time"
          value={params.timeMs}
          min={params.mode === 'slapback' ? 80 : 20}
          max={params.mode === 'slapback' ? 140 : 2000}
          step={params.mode === 'slapback' ? 1 : 10}
          suffix="ms"
          disabled={params.sync}
          onChange={(value) => setParam('timeMs', value)}
        />
        <DelaySlider
          label="Feedback"
          value={params.feedback}
          min={0}
          max={0.95}
          step={0.01}
          onChange={(value) => setParam('feedback', value)}
        />
        <DelaySlider label="Mix" value={params.mix} min={0} max={100} onChange={(value) => setParam('mix', value)} />
        <DelaySlider label="Tone" value={params.tone} min={0} max={100} onChange={(value) => setParam('tone', value)} />
        <DelaySlider
          label="Flutter"
          value={params.flutter}
          min={0}
          max={100}
          disabled={params.mode !== 'tape'}
          onChange={(value) => setParam('flutter', value)}
        />
      </div>

      <div className="tempo-panel">
        <DelaySlider label="BPM" value={params.bpm} min={40} max={240} onChange={setBpm} />
        <label className="delay-control is-wide">
          <span>Division</span>
          <select value={params.division} onChange={(event) => setParam('division', event.target.value)}>
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="dotted1/8">Dotted 1/8</option>
            <option value="1/16">1/16</option>
          </select>
        </label>
        <button type="button" className="tap-tempo-button" onClick={handleTapTempo}>
          Tap Tempo
        </button>
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

type DelaySliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function DelaySlider({ label, value, min, max, step = 1, suffix = '', disabled = false, onChange }: DelaySliderProps) {
  return (
    <KnobControl
      className="delay-control"
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

const readDelayParams = (params: Pedal['params'], tempoBpm: number): DelayParams => ({
  mode: readMode(params.mode),
  timeMs: readNumber(params.timeMs, 420, 20, 2000),
  feedback: readNumber(params.feedback, 0.32, 0, 0.95),
  mix: readPercent(params.mix, 28),
  tone: readNumber(params.tone, 62, 0, 100),
  sync: params.sync === true,
  bpm: readNumber(params.bpm, tempoBpm, 40, 240),
  division: readDivision(params.division),
  flutter: readNumber(params.flutter, 0, 0, 100),
});

const readMode = (value: PedalParamValue | undefined): DelayMode => {
  if (value === 'digital' || value === 'analog' || value === 'tape' || value === 'slapback' || value === 'pingpong') {
    return value;
  }

  return 'digital';
};

const readDivision = (value: PedalParamValue | undefined): DelayDivision => {
  if (value === '1/4' || value === '1/8' || value === 'dotted1/8' || value === '1/16') {
    return value;
  }

  return '1/4';
};

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const readPercent = (value: PedalParamValue | undefined, fallback: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(100, Math.max(0, numberValue > 0 && numberValue <= 1 ? numberValue * 100 : numberValue));
};

const clampDelayTime = (timeMs: number, mode: DelayMode) => {
  if (mode === 'slapback') {
    return Math.min(140, Math.max(80, timeMs));
  }

  return Math.min(2000, Math.max(20, timeMs));
};

const formatMode = (mode: DelayMode) => {
  if (mode === 'pingpong') {
    return 'Pingpong';
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

export default DelayPedal;
