import { useEffect, useMemo, useRef } from 'react';
import { Pedal, PedalParamValue } from '../../audio/types';
import { DriveMode, driveModeLabel, isDriveMode, processDriveSample } from '../../audio/utils/curves';
import KnobControl from '../controls/KnobControl';

type DrivePreset = {
  id: string;
  name: string;
  params: {
    mode: DriveMode;
    drive: number;
    tone: number;
    level: number;
    mix: number;
    bias: number;
  };
};

const DRIVE_PRESETS: DrivePreset[] = [
  {
    id: 'blues-od',
    name: 'Blues OD',
    params: { mode: 'overdrive', drive: 38, tone: 58, level: 76, mix: 88, bias: 0.12 },
  },
  {
    id: 'classic-crunch',
    name: 'Classic Crunch',
    params: { mode: 'crunch', drive: 56, tone: 64, level: 72, mix: 100, bias: 0.02 },
  },
  {
    id: 'hard-rock',
    name: 'Hard Rock',
    params: { mode: 'distortion', drive: 74, tone: 68, level: 70, mix: 100, bias: -0.04 },
  },
  {
    id: 'vintage-fuzz',
    name: 'Vintage Fuzz',
    params: { mode: 'fuzz', drive: 86, tone: 52, level: 68, mix: 100, bias: 0.18 },
  },
];

type DrivePedalProps = {
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

function DrivePedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: DrivePedalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const params = useMemo(() => readDriveParams(pedal.params), [pedal.params]);
  const matchedPreset = DRIVE_PRESETS.find((preset) => isPresetMatch(params, preset))?.id ?? 'custom';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    drawWaveform(canvas, params);
  }, [params]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  const applyPreset = (presetId: string) => {
    const preset = DRIVE_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }

    Object.entries(preset.params).forEach(([name, value]) => setParam(name, value));
  };

  return (
    <article
      className={`pedal-card drive-pedal ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
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
        <button type="button" className="pedal-select drive-display" onClick={() => onSelect(pedal.id)}>
          <span>Drive block</span>
          <strong>DRIVE</strong>
          <em>{driveModeLabel(params.mode)}</em>
        </button>
      </div>

      <canvas ref={canvasRef} className="drive-waveform" width="580" height="146" aria-label="Drive waveform preview" />

      <div className="drive-row">
        <label className="drive-control is-wide">
          <span>Mode</span>
          <select value={params.mode} onChange={(event) => setParam('mode', event.target.value)}>
            <option value="overdrive">Overdrive</option>
            <option value="crunch">Crunch</option>
            <option value="distortion">Distortion</option>
            <option value="fuzz">Fuzz</option>
          </select>
        </label>
        <label className="drive-control is-wide">
          <span>Preset</span>
          <select value={matchedPreset} onChange={(event) => applyPreset(event.target.value)}>
            <option value="custom">Custom</option>
            {DRIVE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="drive-controls">
        <DriveSlider label="Drive" value={params.drive} min={0} max={100} onChange={(value) => setParam('drive', value)} />
        <DriveSlider label="Tone" value={params.tone} min={0} max={100} onChange={(value) => setParam('tone', value)} />
        <DriveSlider label="Level" value={params.level} min={0} max={100} onChange={(value) => setParam('level', value)} />
        <DriveSlider label="Mix" value={params.mix} min={0} max={100} onChange={(value) => setParam('mix', value)} />
        <DriveSlider label="Bias" value={params.bias} min={-1} max={1} step={0.01} onChange={(value) => setParam('bias', value)} />
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

type DriveSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

function DriveSlider({ label, value, min, max, step = 1, onChange }: DriveSliderProps) {
  return (
    <KnobControl className="drive-control" label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
  );
}

const readDriveParams = (params: Pedal['params']) => {
  const mode = isDriveMode(params.mode) ? params.mode : 'overdrive';
  const legacyGain = typeof params.gain === 'number' ? params.gain * 5 : 48;

  return {
    mode,
    drive: readNumber(params.drive, legacyGain, 0, 100),
    tone: readNumber(params.tone, 58, 0, 100),
    level: readNumber(params.level, 72, 0, 100),
    mix: readNumber(params.mix, 100, 0, 100),
    bias: readNumber(params.bias, 0, -1, 1),
  };
};

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const isPresetMatch = (params: ReturnType<typeof readDriveParams>, preset: DrivePreset) =>
  params.mode === preset.params.mode &&
  params.drive === preset.params.drive &&
  params.tone === preset.params.tone &&
  params.level === preset.params.level &&
  params.mix === preset.params.mix &&
  Math.abs(params.bias - preset.params.bias) < 0.001;

const drawWaveform = (canvas: HTMLCanvasElement, params: ReturnType<typeof readDriveParams>) => {
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

  const laneHeight = height / 2;
  drawGrid(context, width, height, laneHeight);
  drawLine(context, width, laneHeight, 0, '#35d0a3', (phase) => Math.sin(phase * Math.PI * 2));
  drawLine(context, width, laneHeight, laneHeight, '#ffcf6d', (phase) => {
    const input = Math.sin(phase * Math.PI * 2) * 0.78 + Math.sin(phase * Math.PI * 6) * 0.08;
    const driven = processDriveSample(
      params.mode,
      input * (1 + (params.drive / 100) * 5.5) + params.bias * 0.22,
      params.drive / 100,
    );
    const mixed = input * (1 - params.mix / 100) + driven * (params.mix / 100);
    return mixed * (0.38 + (params.level / 100) * 0.58);
  });
};

const drawGrid = (context: CanvasRenderingContext2D, width: number, height: number, laneHeight: number) => {
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

  [laneHeight / 2, laneHeight + laneHeight / 2].forEach((y) => {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  });

  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.font = '10px system-ui';
  context.fillText('IN', 10, 16);
  context.fillText('OUT', 10, laneHeight + 16);
};

const drawLine = (
  context: CanvasRenderingContext2D,
  width: number,
  laneHeight: number,
  offsetY: number,
  color: string,
  getSample: (phase: number) => number,
) => {
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();

  for (let x = 0; x <= width; x += 1) {
    const phase = x / width;
    const sample = Math.max(-1, Math.min(1, getSample(phase)));
    const y = offsetY + laneHeight / 2 - sample * (laneHeight * 0.34);
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
};

export default DrivePedal;
