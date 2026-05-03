import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
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
  const strobeBars = useMemo(() => createStrobeBars(cents, reading.signalLow), [cents, reading.signalLow]);

  useEffect(() => subscribeTuner(pedal.id, setReading), [pedal.id]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  return (
    <article
      className={`pedal-card tuner-pedal rack-tuner-module ${selected ? 'is-selected' : ''} ${
        pedal.enabled ? 'is-on' : 'is-off'
      } ${
        isDragging ? 'is-dragging' : ''
      }`}
    >
      <span className="rack-tuner-ear is-left" aria-hidden="true">
        <i />
        <b />
      </span>
      <span className="rack-tuner-ear is-right" aria-hidden="true">
        <i />
        <b />
      </span>

      <div className="rack-tuner-shell">
        <div className="rack-tuner-left">
          <button
            type="button"
            className="drag-handle rack-tuner-drag"
            aria-label={`Move ${pedal.name}`}
            {...dragAttributes}
            {...dragListeners}
          >
            ≡
          </button>
          <button type="button" className="pedal-select tuner-display rack-tuner-brand" onClick={() => onSelect(pedal.id)}>
            <span>Rackmount Chromatic</span>
            <strong>STROBE TUNER</strong>
            <em>{params.mode}</em>
          </button>

          <div className="rack-tuner-mini-controls">
            <button type="button" onClick={() => setParam('referenceA4', params.referenceA4 === 440 ? 442 : 440)}>
              CALIB
            </button>
            <button type="button" onClick={() => setParam('sensitivity', params.sensitivity >= 80 ? 55 : 82)}>
              DISPLAY
            </button>
          </div>
        </div>

        <div className="rack-tuner-note-display">
          <SevenSegmentNote noteName={reading.note?.noteName ?? ''} signalLow={reading.signalLow} />
          <span>{reading.signalLow ? 'NO SIGNAL' : `${reading.frequency?.toFixed(2) ?? '--'} Hz`}</span>
        </div>

        <div className="rack-tuner-strobe" aria-label="Rack strobe cents meter">
          <div className="rack-tuner-scale">
            <span>FLAT</span>
            <strong>{reading.signalLow ? 'SIGNAL LOW' : stateLabel}</strong>
            <span>SHARP</span>
          </div>
          <div className={`rack-strobe-bars ${Math.abs(cents) <= 3 && !reading.signalLow ? 'is-in-tune' : ''}`}>
            {strobeBars.map((bar) => (
              <i
                key={bar.index}
                className={`${bar.active ? 'is-active' : ''} ${bar.center ? 'is-center' : ''}`}
                style={{ '--strobe-hue': `${bar.hue}deg`, '--strobe-alpha': bar.alpha } as CSSProperties}
              />
            ))}
          </div>
          <div className="rack-tuner-cents">
            <span>{reading.signalLow ? '--' : `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(1)} cents`}</span>
            <b>{reading.note?.targetLabel ?? 'Target --'}</b>
          </div>
        </div>

        <div className="rack-tuner-right">
          <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={() => onToggle(pedal.id)}>
            MUTE
          </button>
          <button
            type="button"
            className={pedal.bypassed ? 'is-bypassed' : ''}
            onClick={() => onBypass(pedal.id, !pedal.bypassed)}
          >
            POWER
          </button>
          <div className="rack-tuner-jacks" aria-hidden="true">
            <span>CABLE CHECK</span>
            <span>OUTPUT</span>
            <span>INPUT</span>
          </div>
        </div>
      </div>

      <div className="rack-tuner-control-deck">
        <div className="tuner-controls rack-tuner-controls">
          <label className="tuner-control is-wide rack-tuner-select">
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

        <div className="tuning-guide rack-tuning-guide">
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
      </div>
    </article>
  );
}

function SevenSegmentNote({ noteName, signalLow }: { noteName: string; signalLow: boolean }) {
  const displayNote = signalLow || !noteName ? '--' : noteName.replace(/\d/g, '');
  return (
    <div className="rack-seven-seg" aria-hidden="true">
      <strong>{displayNote.slice(0, 1) || '-'}</strong>
      <em>{displayNote.includes('#') ? '#' : displayNote.includes('b') ? 'b' : ''}</em>
    </div>
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

const createStrobeBars = (cents: number, signalLow: boolean) => {
  const count = 45;
  const centerIndex = Math.floor(count / 2);
  const activeIndex = signalLow ? -1 : Math.round(((cents + 50) / 100) * (count - 1));

  return Array.from({ length: count }, (_item, index) => {
    const distance = Math.abs(index - activeIndex);
    const centerDistance = Math.abs(index - centerIndex);
    return {
      index,
      active: !signalLow && distance <= 2,
      center: centerDistance <= 1,
      hue: 336 + (index / (count - 1)) * 260,
      alpha: signalLow ? 0.18 : Math.max(0.24, 1 - distance * 0.22),
    };
  });
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
