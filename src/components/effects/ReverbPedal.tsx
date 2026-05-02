import { useEffect, useMemo, useRef } from 'react';
import { Pedal, PedalParamValue } from '../../audio/types';
import { ReverbMode, defaultDecayForMode, readReverbMode, reverbModeLabel } from '../../audio/utils/impulse';
import KnobControl from '../controls/KnobControl';

type ReverbParams = {
  mode: ReverbMode;
  decay: number;
  preDelay: number;
  lowCut: number;
  highCut: number;
  mix: number;
  level: number;
};

type ReverbPedalProps = {
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

function ReverbPedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: ReverbPedalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const params = useMemo(() => readReverbParams(pedal.params), [pedal.params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    drawReverbTail(canvas, params);
  }, [params]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  const setMode = (mode: ReverbMode) => {
    setParam('mode', mode);
    setParam('decay', defaultDecayForMode(mode));
  };

  return (
    <article
      className={`pedal-card reverb-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select reverb-display" onClick={() => onSelect(pedal.id)}>
          <span>Space engine</span>
          <strong>REVERB</strong>
          <em>
            {reverbModeLabel(params.mode)} / {params.decay.toFixed(1)}s
          </em>
        </button>
      </div>

      <canvas ref={canvasRef} className="reverb-tail-canvas" width="580" height="146" aria-label="Reverb tail graph" />

      <div className="reverb-row">
        <label className="reverb-control is-wide">
          <span>Mode</span>
          <select value={params.mode} onChange={(event) => setMode(readReverbMode(event.target.value))}>
            <option value="room">Room</option>
            <option value="hall">Hall</option>
            <option value="plate">Plate</option>
            <option value="spring">Spring</option>
            <option value="ambient">Ambient</option>
          </select>
        </label>
      </div>

      <div className="reverb-controls">
        <ReverbSlider
          label="Decay"
          value={params.decay}
          min={0.2}
          max={10}
          step={0.1}
          suffix="s"
          onChange={(value) => setParam('decay', value)}
        />
        <ReverbSlider
          label="PreDelay"
          value={params.preDelay}
          min={0}
          max={200}
          suffix="ms"
          onChange={(value) => setParam('preDelay', value)}
        />
        <ReverbSlider
          label="LowCut"
          value={params.lowCut}
          min={20}
          max={500}
          suffix="Hz"
          onChange={(value) => setParam('lowCut', value)}
        />
        <ReverbSlider
          label="HighCut"
          value={params.highCut}
          min={1000}
          max={12000}
          step={100}
          suffix="Hz"
          onChange={(value) => setParam('highCut', value)}
        />
        <ReverbSlider label="Mix" value={params.mix} min={0} max={100} onChange={(value) => setParam('mix', value)} />
        <ReverbSlider label="Level" value={params.level} min={0} max={100} onChange={(value) => setParam('level', value)} />
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

type ReverbSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function ReverbSlider({ label, value, min, max, step = 1, suffix = '', onChange }: ReverbSliderProps) {
  return (
    <KnobControl
      className="reverb-control"
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      onChange={onChange}
    />
  );
}

const readReverbParams = (params: Pedal['params']): ReverbParams => {
  const mode = readReverbMode(params.mode);
  const legacySize = typeof params.size === 'number' ? 0.2 + params.size * 5.8 : defaultDecayForMode(mode);
  const legacyHighCut =
    typeof params.damping === 'number' ? Math.min(12000, Math.max(1000, 12000 - params.damping * 9000)) : 7600;

  return {
    mode,
    decay: readNumber(params.decay, legacySize, 0.2, 10),
    preDelay: readNumber(params.preDelay, 22, 0, 200),
    lowCut: readNumber(params.lowCut, 120, 20, 500),
    highCut: readNumber(params.highCut, legacyHighCut, 1000, 12000),
    mix: readPercent(params.mix, 24),
    level: readNumber(params.level, 72, 0, 100),
  };
};

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const readPercent = (value: PedalParamValue | undefined, fallback: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(100, Math.max(0, numberValue > 0 && numberValue <= 1 ? numberValue * 100 : numberValue));
};

const drawReverbTail = (canvas: HTMLCanvasElement, params: ReverbParams) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 290;
  const height = canvas.clientHeight || 73;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  drawGrid(context, width, height);
  drawTail(context, width, height, params);
};

const drawGrid = (context: CanvasRenderingContext2D, width: number, height: number) => {
  context.fillStyle = '#0a0d0c';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 1;

  for (let index = 1; index < 6; index += 1) {
    const x = (width / 6) * index;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  [0.25, 0.5, 0.75].forEach((unit) => {
    const y = height * unit;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  });

  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.font = '10px system-ui';
  context.fillText('TAIL', 10, 16);
};

const drawTail = (context: CanvasRenderingContext2D, width: number, height: number, params: ReverbParams) => {
  const color = params.mode === 'plate' ? '#ffcf6d' : params.mode === 'spring' ? '#8abaff' : '#35d0a3';
  context.strokeStyle = color;
  context.lineWidth = 2.4;
  context.beginPath();

  for (let x = 0; x <= width; x += 1) {
    const progress = x / width;
    const time = progress * params.decay;
    const preDelayOffset = Math.min(0.18, params.preDelay / 1000 / Math.max(0.2, params.decay));
    const envelope = progress < preDelayOffset ? 0 : Math.exp((-time * tailSlope(params.mode)) / params.decay);
    const texture = modeTexture(progress, params.mode);
    const filterTilt = Math.max(0.22, Math.min(1.15, params.highCut / 7600)) * Math.max(0.45, 1 - params.lowCut / 900);
    const value = envelope * texture * filterTilt;
    const y = height - value * (height * 0.72) - height * 0.14;

    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
};

const tailSlope = (mode: ReverbMode) => {
  if (mode === 'ambient') {
    return 3.5;
  }

  if (mode === 'hall') {
    return 4.8;
  }

  if (mode === 'plate') {
    return 5.8;
  }

  if (mode === 'spring') {
    return 6.2;
  }

  return 8.2;
};

const modeTexture = (progress: number, mode: ReverbMode) => {
  if (mode === 'spring') {
    return 0.74 + Math.abs(Math.sin(progress * Math.PI * 18)) * 0.26;
  }

  if (mode === 'plate') {
    return 0.86 + Math.sin(progress * Math.PI * 9) * 0.08;
  }

  if (mode === 'ambient') {
    return 0.92 + Math.sin(progress * Math.PI * 4) * 0.06;
  }

  return 0.86 + Math.sin(progress * Math.PI * 6) * 0.06;
};

export default ReverbPedal;
