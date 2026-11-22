import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { emptyLooperReading, LooperReading, subscribeLooper } from '../../../audio/nodes/LooperNode';
import { Pedal, PedalParamValue } from '../../../audio/types';
import KnobControl from '../../controls/KnobControl';
import '../../../styles/components/looper.css';
import { t } from '../../../i18n/ko';

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
  const unavailable = reading.state === 'loading' || reading.state === 'error' || !pedal.enabled || pedal.bypassed;
  const sendCommand = (command: string) => {
    if (unavailable) return;
    if (command === 'clear' && reading.hasLoop && !window.confirm(t('confirm.clearLoop'))) return;
    if (command === 'record' && reading.hasLoop && reading.state !== 'recording' && !window.confirm(t('confirm.rerecordLoop'))) return;
    onParamChange(pedal.id, '__looperCommand', command);
  };

  return (
    <article
      className={`pedal-card looper-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select looper-display" onClick={() => onSelect(pedal.id)}>
          <span>{t('panel.looper.title')}</span>
          <strong>{t('panel.looper.lettering')}</strong>
          <em>{formatLooperState(reading.state)}</em>
        </button>
      </div>

      <div className="looper-progress-wrap">
        <div
          className={`looper-progress ${reading.state === 'recording' ? 'is-recording' : ''}`}
          style={{ '--progress': `${Math.max(0, Math.min(1, reading.progress)) * 360}deg` } as CSSProperties}
        >
          <strong>{reading.hasLoop ? `${reading.durationSec.toFixed(1)}s` : '--'}</strong>
          <span>{reading.hasLoop ? `${Math.round(reading.progress * 100)}%` : t('panel.common.empty')}</span>
        </div>
        <div className="looper-status">
          <span>{t('panel.looper.state')}</span>
          <strong>{formatLooperState(reading.state)}</strong>
          <small>
            {params.halfSpeed ? t('panel.looper.halfSpeedPrefix') : ''}
            {params.reverse ? t('panel.looper.reverseShort') : reading.canUndo ? t('panel.looper.undoAvailable') : reading.hasLoop ? t('panel.looper.ready') : t('panel.looper.noRecording')}
          </small>
        </div>
      </div>

      {unavailable && <p role="status">{reading.state === 'error' ? t('error.looperFailed') : !pedal.enabled || pedal.bypassed ? t('panel.looper.enableHint') : t('panel.looper.connectHint')}</p>}
      <div className="looper-footswitches">
        <button
          type="button"
          className={reading.state === 'recording' ? 'is-recording' : ''}
          disabled={unavailable}
          onClick={() => sendCommand('record')}
        >
          
          {t('panel.looper.record')}
        </button>
        <button
          type="button"
          className={reading.state === 'playing' ? 'is-playing' : ''}
          disabled={unavailable || !reading.hasLoop}
          onClick={() => sendCommand('play')}
        >
          
          {t('panel.common.play')}
        </button>
        <button
          type="button"
          className={reading.state === 'overdubbing' ? 'is-overdubbing' : ''}
          disabled={unavailable}
          onClick={() => sendCommand('overdub')}
        >
          
          {t('panel.looper.overdub')}
        </button>
      </div>

      <div className="looper-actions">
        <button type="button" disabled={unavailable} onClick={() => sendCommand('stop')}>
          
          {t('panel.common.stop')}
        </button>
        <button type="button" onClick={() => sendCommand('undo')} disabled={unavailable || !reading.canUndo}>
          
          {t('panel.looper.undo')}
        </button>
        <button type="button" className="is-danger" disabled={unavailable || !reading.hasLoop} onClick={() => sendCommand('clear')}>
          
          {t('panel.looper.clear')}
        </button>
      </div>

      <div className="looper-controls">
        <LooperSlider label="재생 음량" value={params.level} min={0} max={100} onChange={(value) => setParam('level', value)} />
        <LooperSlider
          label="겹침 음량"
          value={params.overdubLevel}
          min={0}
          max={100}
          onChange={(value) => setParam('overdubLevel', value)}
        />
        <LooperSlider
          label="기존 루프 유지량"
          value={params.feedback}
          min={0}
          max={100}
          onChange={(value) => setParam('feedback', value)}
        />
        <label className="looper-control is-wide">
          <span>{t('param.looper.quantize')}</span>
          <select value={params.quantize} onChange={(event) => setParam('quantize', event.target.value)}>
            <option value="off">{t('panel.looper.quantizeOff')}</option>
            <option value="1bar">{t('panel.looper.bar1')}</option>
            <option value="2bar">{t('panel.looper.bar2')}</option>
            <option value="4bar">{t('panel.looper.bar4')}</option>
          </select>
        </label>
      </div>

      <p>{t('panel.looper.quantizeNote')}</p>
      <div className="looper-toggles">
        <label>
          <span>{t('param.looper.halfSpeed')}</span>
          <input type="checkbox" checked={params.halfSpeed} onChange={(event) => setParam('halfSpeed', event.target.checked)} />
        </label>
        <label>
          <span>{t('param.looper.reverse')}</span>
          <input type="checkbox" checked={params.reverse} onChange={(event) => setParam('reverse', event.target.checked)} />
        </label>
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

type LooperSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function LooperSlider({ label, value, min, max, onChange }: LooperSliderProps) {
  return (
    <KnobControl className="looper-control" label={label} value={value} min={min} max={max} step={1} onChange={onChange} />
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
    return '겹쳐 녹음 중';
  }

  if (state === 'recording') {
    return '녹음 중';
  }

  if (state === 'playing') {
    return '재생 중';
  }

  if (state === 'stopped') {
    return '정지';
  }

  if (state === 'loading') {
    return '불러오는 중';
  }

  if (state === 'error') {
    return '오디오 처리 오류';
  }

  return '대기';
};

export default LooperPanel;
