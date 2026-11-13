import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { emptyLooperReading, LooperReading, subscribeLooper } from '../../audio/nodes/LooperNode';
import { Pedal, PedalParamValue } from '../../audio/types';
import KnobControl from '../controls/KnobControl';

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
    if (command === 'clear' && reading.hasLoop && !window.confirm('녹음된 루프를 지울까요?')) return;
    if (command === 'record' && reading.hasLoop && reading.state !== 'recording' && !window.confirm('기존 루프를 지우고 새로 녹음할까요?')) return;
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
          aria-label={`Move ${pedal.name}`}
          {...dragAttributes}
          {...dragListeners}
        >
          ≡
        </button>) : null}
        <button type="button" className="pedal-select looper-display" onClick={() => onSelect(pedal.id)}>
          <span>루프 녹음기</span>
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
          <span>{reading.hasLoop ? `${Math.round(reading.progress * 100)}%` : '비어 있음'}</span>
        </div>
        <div className="looper-status">
          <span>상태</span>
          <strong>{formatLooperState(reading.state)}</strong>
          <small>
            {params.halfSpeed ? '반속 재생 · ' : ''}
            {params.reverse ? '역방향' : reading.canUndo ? '되돌리기 가능' : reading.hasLoop ? '루프 준비됨' : '녹음 없음'}
          </small>
        </div>
      </div>

      {unavailable && <p role="status">{reading.state === 'error' ? '루퍼를 시작하지 못했습니다. 브라우저와 오디오 연결을 확인해 주세요.' : !pedal.enabled || pedal.bypassed ? '루퍼를 켜고 바이패스를 해제해 주세요.' : '기타 또는 오디오를 연결하면 루퍼를 사용할 수 있습니다.'}</p>}
      <div className="looper-footswitches">
        <button
          type="button"
          className={reading.state === 'recording' ? 'is-recording' : ''}
          disabled={unavailable}
          onClick={() => sendCommand('record')}
        >
          녹음
        </button>
        <button
          type="button"
          className={reading.state === 'playing' ? 'is-playing' : ''}
          disabled={unavailable || !reading.hasLoop}
          onClick={() => sendCommand('play')}
        >
          재생
        </button>
        <button
          type="button"
          className={reading.state === 'overdubbing' ? 'is-overdubbing' : ''}
          disabled={unavailable}
          onClick={() => sendCommand('overdub')}
        >
          겹쳐 녹음
        </button>
      </div>

      <div className="looper-actions">
        <button type="button" disabled={unavailable} onClick={() => sendCommand('stop')}>
          정지
        </button>
        <button type="button" onClick={() => sendCommand('undo')} disabled={unavailable || !reading.canUndo}>
          되돌리기
        </button>
        <button type="button" className="is-danger" disabled={unavailable || !reading.hasLoop} onClick={() => sendCommand('clear')}>
          지우기
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
          <span>길이 맞춤</span>
          <select value={params.quantize} onChange={(event) => setParam('quantize', event.target.value)}>
            <option value="off">사용 안 함</option>
            <option value="1bar">1마디</option>
            <option value="2bar">2마디</option>
            <option value="4bar">4마디</option>
          </select>
        </label>
      </div>

      <p>길이 맞춤은 현재 템포의 4/4 마디 기준입니다. 지정 길이보다 짧은 녹음은 원래 길이를 유지합니다.</p>
      <div className="looper-toggles">
        <label>
          <span>반속 재생</span>
          <input type="checkbox" checked={params.halfSpeed} onChange={(event) => setParam('halfSpeed', event.target.checked)} />
        </label>
        <label>
          <span>역방향 재생</span>
          <input type="checkbox" checked={params.reverse} onChange={(event) => setParam('reverse', event.target.checked)} />
        </label>
      </div>

      <div className="pedal-switches">
        <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={() => onToggle(pedal.id)}>
          {pedal.enabled ? '켜짐' : '꺼짐'}
        </button>
        <button
          type="button"
          className={pedal.bypassed ? 'is-bypassed' : ''}
          onClick={() => onBypass(pedal.id, !pedal.bypassed)}
        >
          {pedal.bypassed ? '바이패스 해제' : '바이패스'}
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
