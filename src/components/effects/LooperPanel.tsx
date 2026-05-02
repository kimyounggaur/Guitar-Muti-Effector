import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { emptyLooperReading, LooperReading, subscribeLooper } from '../../audio/nodes/LooperNode';
import { Pedal, PedalParamValue } from '../../audio/types';

type LooperParams = {
  level: number;
  overdubLevel: number;
  feedback: number;
  quantize: 'off' | '1bar' | '2bar' | '4bar';
  reverse: boolean;
  halfSpeed: boolean;
};

type LooperPanelProps = {
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

function LooperPanel({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: LooperPanelProps) {
  const [reading, setReading] = useState<LooperReading>(emptyLooperReading);
  const params = useMemo(() => readLooperParams(pedal.params), [pedal.params]);

  useEffect(() => subscribeLooper(pedal.id, setReading), [pedal.id]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);
  const sendCommand = (command: string) => onParamChange(pedal.id, '__looperCommand', command);

  return (
    <article
      className={`pedal-card looper-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select looper-display" onClick={() => onSelect(pedal.id)}>
          <span>Phrase looper</span>
          <strong>LOOPER</strong>
          <em>{formatLooperState(reading.state)}</em>
        </button>
      </div>

      <div className="looper-progress-wrap">
        <div
          className={`looper-progress ${reading.state === 'recording' ? 'is-recording' : ''}`}
          style={{ '--progress': `${Math.max(0, Math.min(1, reading.progress)) * 360}deg` } as CSSProperties}
        >
          <strong>{reading.hasLoop ? `${reading.durationSec.toFixed(1)}s` : '--'}</strong>
          <span>{reading.hasLoop ? `${Math.round(reading.progress * 100)}%` : 'Empty'}</span>
        </div>
        <div className="looper-status">
          <span>Status</span>
          <strong>{formatLooperState(reading.state)}</strong>
          <small>
            {params.halfSpeed ? 'Half Speed ' : ''}
            {params.reverse ? 'Reverse' : reading.canUndo ? 'Undo ready' : reading.hasLoop ? 'Loop ready' : 'No loop'}
          </small>
        </div>
      </div>

      <div className="looper-footswitches">
        <button
          type="button"
          className={reading.state === 'recording' ? 'is-recording' : ''}
          onClick={() => sendCommand('record')}
        >
          REC
        </button>
        <button
          type="button"
          className={reading.state === 'playing' ? 'is-playing' : ''}
          onClick={() => sendCommand('play')}
        >
          PLAY
        </button>
        <button
          type="button"
          className={reading.state === 'overdubbing' ? 'is-overdubbing' : ''}
          onClick={() => sendCommand('overdub')}
        >
          OVERDUB
        </button>
      </div>

      <div className="looper-actions">
        <button type="button" onClick={() => sendCommand('stop')}>
          Stop
        </button>
        <button type="button" onClick={() => sendCommand('undo')} disabled={!reading.canUndo}>
          Undo
        </button>
        <button type="button" className="is-danger" onClick={() => sendCommand('clear')}>
          Clear
        </button>
      </div>

      <div className="looper-controls">
        <LooperSlider label="Level" value={params.level} min={0} max={100} onChange={(value) => setParam('level', value)} />
        <LooperSlider
          label="Overdub"
          value={params.overdubLevel}
          min={0}
          max={100}
          onChange={(value) => setParam('overdubLevel', value)}
        />
        <LooperSlider
          label="Feedback"
          value={params.feedback}
          min={0}
          max={100}
          onChange={(value) => setParam('feedback', value)}
        />
        <label className="looper-control is-wide">
          <span>Quantize</span>
          <select value={params.quantize} onChange={(event) => setParam('quantize', event.target.value)}>
            <option value="off">Off</option>
            <option value="1bar">1 Bar</option>
            <option value="2bar">2 Bars</option>
            <option value="4bar">4 Bars</option>
          </select>
        </label>
      </div>

      <div className="looper-toggles">
        <label>
          <span>Half Speed</span>
          <input type="checkbox" checked={params.halfSpeed} onChange={(event) => setParam('halfSpeed', event.target.checked)} />
        </label>
        <label>
          <span>Reverse</span>
          <input type="checkbox" checked={params.reverse} onChange={(event) => setParam('reverse', event.target.checked)} />
        </label>
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

type LooperSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function LooperSlider({ label, value, min, max, onChange }: LooperSliderProps) {
  return (
    <label className="looper-control">
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

const readLooperParams = (params: Pedal['params']): LooperParams => ({
  level: readNumber(params.level, 85, 0, 100),
  overdubLevel: readNumber(params.overdubLevel, 85, 0, 100),
  feedback: readNumber(params.feedback, 100, 0, 100),
  quantize: readQuantize(params.quantize),
  reverse: params.reverse === true,
  halfSpeed: params.halfSpeed === true,
});

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const readQuantize = (value: PedalParamValue | undefined): LooperParams['quantize'] => {
  if (value === '1bar' || value === '2bar' || value === '4bar') {
    return value;
  }

  return 'off';
};

const formatLooperState = (state: LooperReading['state']) => {
  if (state === 'overdubbing') {
    return 'Overdub';
  }

  if (state === 'recording') {
    return 'Recording';
  }

  if (state === 'playing') {
    return 'Playing';
  }

  if (state === 'stopped') {
    return 'Stopped';
  }

  if (state === 'loading') {
    return 'Loading';
  }

  if (state === 'error') {
    return 'Worklet Error';
  }

  return 'Idle';
};

export default LooperPanel;
