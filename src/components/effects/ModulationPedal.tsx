import { useMemo } from 'react';
import {
  ModulationDivision,
  ModulationMode,
  bpmToModRateHz,
  modulationModeLabel,
} from '../../audio/nodes/ModulationEffect';
import { Pedal, PedalParamValue } from '../../audio/types';
import { useTempoStore } from '../../store/tempoStore';
import KnobControl from '../controls/KnobControl';

type ModulationParams = {
  mode: ModulationMode;
  rate: number;
  depth: number;
  feedback: number;
  mix: number;
  tone: number;
  stereoWidth: number;
  sync: boolean;
  bpm: number;
  division: ModulationDivision;
};

type ModulationPedalProps = {
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

function ModulationPedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: ModulationPedalProps) {
  const tempoBpm = useTempoStore((state) => state.bpm);
  const setTempoBpm = useTempoStore((state) => state.setBpm);
  const tapTempo = useTempoStore((state) => state.tapTempo);
  const params = useMemo(() => readModulationParams(pedal.params, tempoBpm), [pedal.params, tempoBpm]);
  const effectiveRate = params.sync ? bpmToModRateHz(params.bpm, params.division) : params.rate;
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
      className={`pedal-card modulation-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select modulation-display" onClick={() => onSelect(pedal.id)}>
          <span>Motion block</span>
          <strong>MOD</strong>
          <em>
            {modulationModeLabel(params.mode)} / {formatRate(effectiveRate)}
          </em>
        </button>
      </div>

      <div className={`modulation-orbit is-${params.mode}`}>
        <i />
        <i />
        <i />
        <strong>{modulationModeLabel(params.mode)}</strong>
        <span>{params.sync ? params.division : 'Free'}</span>
      </div>

      <div className="modulation-row">
        <label className="modulation-control is-wide">
          <span>Mode</span>
          <select value={params.mode} onChange={(event) => setParam('mode', event.target.value)}>
            <option value="chorus">Chorus</option>
            <option value="flanger">Flanger</option>
            <option value="phaser">Phaser</option>
            <option value="tremolo">Tremolo</option>
            <option value="vibrato">Vibrato</option>
          </select>
        </label>
        <label className="modulation-sync-toggle">
          <span>Sync</span>
          <input type="checkbox" checked={params.sync} onChange={(event) => setParam('sync', event.target.checked)} />
        </label>
      </div>

      <div className="modulation-controls">
        <ModSlider
          label="Rate"
          value={params.rate}
          min={0.05}
          max={20}
          step={0.05}
          suffix="Hz"
          disabled={params.sync}
          onChange={(value) => setParam('rate', value)}
        />
        <ModSlider label="Depth" value={params.depth} min={0} max={100} onChange={(value) => setParam('depth', value)} />
        <ModSlider
          label="Feedback"
          value={params.feedback}
          min={0}
          max={0.95}
          step={0.01}
          disabled={params.mode === 'chorus' || params.mode === 'tremolo' || params.mode === 'vibrato'}
          onChange={(value) => setParam('feedback', value)}
        />
        <ModSlider label="Mix" value={params.mix} min={0} max={100} onChange={(value) => setParam('mix', value)} />
        <ModSlider label="Tone" value={params.tone} min={0} max={100} onChange={(value) => setParam('tone', value)} />
        <ModSlider
          label="Width"
          value={params.stereoWidth}
          min={0}
          max={100}
          onChange={(value) => setParam('stereoWidth', value)}
        />
      </div>

      <div className="modulation-tempo-panel">
        <ModSlider label="BPM" value={params.bpm} min={40} max={240} disabled={!params.sync} onChange={setBpm} />
        <label className="modulation-control is-wide">
          <span>Division</span>
          <select value={params.division} disabled={!params.sync} onChange={(event) => setParam('division', event.target.value)}>
            <option value="1/1">1/1</option>
            <option value="1/2">1/2</option>
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

type ModSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function ModSlider({ label, value, min, max, step = 1, suffix = '', disabled = false, onChange }: ModSliderProps) {
  return (
    <KnobControl
      className="modulation-control"
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

const readModulationParams = (params: Pedal['params'], tempoBpm: number): ModulationParams => ({
  mode: readMode(params.mode),
  rate: readNumber(params.rate, 0.85, 0.05, 20),
  depth: readNumber(params.depth, 44, 0, 100),
  feedback: readNumber(params.feedback, 0.18, 0, 0.95),
  mix: readPercent(params.mix, 42),
  tone: readNumber(params.tone, 68, 0, 100),
  stereoWidth: readNumber(params.stereoWidth, 52, 0, 100),
  sync: params.sync === true,
  bpm: readNumber(params.bpm, tempoBpm, 40, 240),
  division: readDivision(params.division),
});

const readMode = (value: PedalParamValue | undefined): ModulationMode => {
  if (value === 'chorus' || value === 'flanger' || value === 'phaser' || value === 'tremolo' || value === 'vibrato') {
    return value;
  }

  return 'chorus';
};

const readDivision = (value: PedalParamValue | undefined): ModulationDivision => {
  if (value === '1/1' || value === '1/2' || value === '1/4' || value === '1/8' || value === 'dotted1/8' || value === '1/16') {
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

const formatRate = (rate: number) => `${rate < 10 ? rate.toFixed(2) : rate.toFixed(1)}Hz`;

export default ModulationPedal;
