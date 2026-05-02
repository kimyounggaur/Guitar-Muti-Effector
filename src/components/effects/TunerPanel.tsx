import { useEffect, useMemo, useState } from 'react';
import { emptyTunerReading, subscribeTuner, TunerReading } from '../../audio/nodes/TunerNode';
import { Pedal, PedalParamValue } from '../../audio/types';
import { isTunerMode, midiToFrequency, STANDARD_TUNINGS, TunerMode } from '../../audio/utils/pitch';
import KnobControl from '../controls/KnobControl';

type TunerPanelProps = {
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

function TunerPanel({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: TunerPanelProps) {
  const [reading, setReading] = useState<TunerReading>(emptyTunerReading);
  const params = useMemo(() => readTunerParams(pedal.params), [pedal.params]);
  const cents = Math.max(-50, Math.min(50, reading.cents));
  const stateLabel = getTuningState(reading);

  useEffect(() => subscribeTuner(pedal.id, setReading), [pedal.id]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  return (
    <article
      className={`pedal-card tuner-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select tuner-display" onClick={() => onSelect(pedal.id)}>
          <span>Pitch detector</span>
          <strong>TUNER</strong>
          <em>{params.mode}</em>
        </button>
      </div>

      <div className={`tuner-readout ${reading.signalLow ? 'is-low' : ''} ${Math.abs(cents) <= 3 ? 'is-in-tune' : ''}`}>
        <span>{reading.signalLow ? 'Signal Low' : stateLabel}</span>
        <strong>{reading.note ? reading.note.noteName : '--'}</strong>
        <em>{reading.note ? reading.note.octave : ''}</em>
        <small>{reading.frequency ? `${reading.frequency.toFixed(2)} Hz` : 'Play a string'}</small>
      </div>

      <div className="cents-meter" aria-label="Cents meter">
        <span>Low</span>
        <div className="cents-track">
          <i className="cents-center" />
          <b style={{ left: `${50 + cents}%` }} />
        </div>
        <span>High</span>
      </div>

      <div className="cents-value">
        <strong>{reading.signalLow ? '--' : `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(1)} cents`}</strong>
        <span>{reading.note?.targetLabel ?? 'Target --'}</span>
      </div>

      <div className="tuner-controls">
        <label className="tuner-control is-wide">
          <span>Mode</span>
          <select value={params.mode} onChange={(event) => setParam('mode', event.target.value)}>
            <option value="chromatic">Chromatic</option>
            <option value="guitar">Guitar</option>
            <option value="bass">Bass</option>
            <option value="ukulele">Ukulele</option>
          </select>
        </label>
        <TunerSlider
          label="A4"
          value={params.referenceA4}
          min={430}
          max={450}
          suffix="Hz"
          onChange={(value) => setParam('referenceA4', value)}
        />
        <TunerSlider
          label="Sense"
          value={params.sensitivity}
          min={0}
          max={100}
          onChange={(value) => setParam('sensitivity', value)}
        />
        <TunerSlider
          label="Smooth"
          value={params.smoothing}
          min={0}
          max={100}
          onChange={(value) => setParam('smoothing', value)}
        />
      </div>

      <div className="tuning-guide">
        <span>Standard Guitar</span>
        <div>
          {STANDARD_TUNINGS.guitar.map((string) => (
            <strong key={string.label} className={reading.note?.targetLabel === string.label ? 'is-target' : ''}>
              {string.label}
              <small>{midiToFrequency(string.midi, params.referenceA4).toFixed(2)}</small>
            </strong>
          ))}
        </div>
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

type TunerSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function TunerSlider({ label, value, min, max, suffix = '', onChange }: TunerSliderProps) {
  return (
    <KnobControl
      className="tuner-control"
      label={label}
      value={value}
      min={min}
      max={max}
      step={1}
      suffix={suffix}
      onChange={onChange}
    />
  );
}

const readTunerParams = (params: Pedal['params']) => ({
  referenceA4: readNumber(params.referenceA4, readNumber(params.referenceHz, 440, 430, 450), 430, 450),
  mode: isTunerMode(params.mode) ? params.mode : ('guitar' as TunerMode),
  sensitivity: readNumber(params.sensitivity, 64, 0, 100),
  smoothing: readNumber(params.smoothing, 62, 0, 100),
});

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const getTuningState = (reading: TunerReading) => {
  if (reading.signalLow) {
    return 'Signal Low';
  }

  if (Math.abs(reading.cents) <= 3) {
    return 'In Tune';
  }

  return reading.cents < 0 ? 'Low' : 'High';
};

export default TunerPanel;
