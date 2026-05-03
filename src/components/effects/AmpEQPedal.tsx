import { useEffect, useMemo, useRef } from 'react';
import { Pedal, PedalParamValue } from '../../audio/types';
import KnobControl from '../controls/KnobControl';

type AmpEQParams = {
  lowCut: number;
  bass: number;
  mid: number;
  midFreq: number;
  midQ: number;
  treble: number;
  presence: number;
  level: number;
};

type AmpEQPreset = {
  id: string;
  name: string;
  params: AmpEQParams;
};

const AMP_EQ_PRESETS: AmpEQPreset[] = [
  {
    id: 'clean',
    name: 'Clean',
    params: { lowCut: 65, bass: 1.5, mid: 0.5, midFreq: 720, midQ: 0.8, treble: 2, presence: 1.5, level: 72 },
  },
  {
    id: 'warm',
    name: 'Warm',
    params: { lowCut: 55, bass: 4, mid: 2, midFreq: 620, midQ: 0.9, treble: -1.5, presence: -1, level: 74 },
  },
  {
    id: 'crunch',
    name: 'Crunch',
    params: { lowCut: 80, bass: 2, mid: 3.5, midFreq: 820, midQ: 1.1, treble: 2.5, presence: 2, level: 70 },
  },
  {
    id: 'metal',
    name: 'Metal',
    params: { lowCut: 95, bass: 5, mid: -4.5, midFreq: 650, midQ: 1.35, treble: 4, presence: 5, level: 68 },
  },
  {
    id: 'scooped',
    name: 'Scooped',
    params: { lowCut: 90, bass: 4.5, mid: -7, midFreq: 720, midQ: 1.5, treble: 3.5, presence: 3, level: 70 },
  },
];

const AMP_EQ_RESET_PARAMS: AmpEQParams = {
  lowCut: 70,
  bass: 0,
  mid: 0,
  midFreq: 760,
  midQ: 0.9,
  treble: 0,
  presence: 0,
  level: 72,
};

type AmpEQPedalProps = {
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

function AmpEQPedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: AmpEQPedalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const params = useMemo(() => readAmpEQParams(pedal.params), [pedal.params]);
  const matchedPreset = AMP_EQ_PRESETS.find((preset) => isPresetMatch(params, preset))?.id ?? 'custom';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    drawEQCurve(canvas, params);
  }, [params]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  const applyPreset = (presetId: string) => {
    const preset = AMP_EQ_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) {
      return;
    }

    Object.entries(preset.params).forEach(([name, value]) => setParam(name, value));
  };

  const resetEQ = () => {
    Object.entries(AMP_EQ_RESET_PARAMS).forEach(([name, value]) => setParam(name, value));
  };

  return (
    <article
      className={`pedal-card amp-eq-pedal classic-eq-module ${selected ? 'is-selected' : ''} ${
        pedal.enabled ? 'is-on' : 'is-off'
      } ${
        isDragging ? 'is-dragging' : ''
      }`}
    >
      <span className="classic-eq-slot is-top-left" aria-hidden="true" />
      <span className="classic-eq-slot is-top-right" aria-hidden="true" />
      <span className="classic-eq-slot is-bottom-left" aria-hidden="true" />
      <span className="classic-eq-slot is-bottom-right" aria-hidden="true" />

      <div className="classic-eq-header">
        <button
          type="button"
          className="drag-handle classic-eq-drag"
          aria-label={`Move ${pedal.name}`}
          {...dragAttributes}
          {...dragListeners}
        >
          ≡
        </button>
        <button type="button" className="pedal-select amp-eq-display classic-eq-title" onClick={() => onSelect(pedal.id)}>
          <span>AMP MODULE</span>
          <strong>CLASSIC EQ</strong>
          <em>{formatToneLabel(params)}</em>
        </button>
        <label className="classic-eq-preset">
          <span>Preset</span>
          <select value={matchedPreset} onChange={(event) => applyPreset(event.target.value)}>
            <option value="custom">Custom</option>
            {AMP_EQ_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="classic-eq-top-deck">
        <div className="classic-eq-toggle-stack">
          <span className="classic-eq-lamp is-reset" aria-hidden="true" />
          <button type="button" className="classic-eq-metal-toggle" onClick={resetEQ}>
            Reset
          </button>
          <div className="classic-eq-mode-pad" aria-label="Channel mode">
            <button type="button">L</button>
            <button type="button" className="is-active">
              L/R
            </button>
            <button type="button">R</button>
            <button type="button">M/S</button>
          </div>
        </div>

        <div className="classic-eq-graph-wrap">
          <canvas ref={canvasRef} className="eq-curve-canvas" width="760" height="186" aria-label="Amp EQ curve graph" />
          <div className="classic-eq-graph-labels" aria-hidden="true">
            <span>20Hz</span>
            <span>200Hz</span>
            <span>+20dB</span>
            <span>2kHz</span>
            <span>20kHz</span>
            <span>-20dB</span>
          </div>
        </div>

        <div className="classic-eq-toggle-stack is-bypass">
          <span className={`classic-eq-lamp ${pedal.bypassed ? 'is-lit' : ''}`} aria-hidden="true" />
          <button
            type="button"
            className={`classic-eq-metal-toggle ${pedal.bypassed ? 'is-bypassed' : ''}`}
            onClick={() => onBypass(pedal.id, !pedal.bypassed)}
          >
            Bypass
          </button>
        </div>
      </div>

      <div className="classic-eq-main-controls">
        <EQSlider
          band="1"
          label="Low Cut"
          value={params.lowCut}
          min={40}
          max={160}
          suffix="Hz"
          onChange={(value) => setParam('lowCut', value)}
        />
        <EQSlider
          band="2"
          label="Bass"
          value={params.bass}
          min={-12}
          max={12}
          step={0.5}
          suffix="dB"
          onChange={(value) => setParam('bass', value)}
        />
        <EQSlider
          band="3"
          label="Mid"
          value={params.mid}
          min={-12}
          max={12}
          step={0.5}
          suffix="dB"
          onChange={(value) => setParam('mid', value)}
        />
        <EQSlider
          band="4"
          label="Treble"
          value={params.treble}
          min={-12}
          max={12}
          step={0.5}
          suffix="dB"
          onChange={(value) => setParam('treble', value)}
        />
        <EQSlider
          band="5"
          label="Presence"
          value={params.presence}
          min={-12}
          max={12}
          step={0.5}
          suffix="dB"
          onChange={(value) => setParam('presence', value)}
        />
        <EQSlider
          band="6"
          label="Output"
          value={params.level}
          min={0}
          max={100}
          onChange={(value) => setParam('level', value)}
        />
      </div>

      <div className="classic-eq-lower-controls">
        <span>Freq / Q</span>
        <EQSlider
          label="Mid Freq"
          value={params.midFreq}
          min={250}
          max={1500}
          step={10}
          suffix="Hz"
          onChange={(value) => setParam('midFreq', value)}
        />
        <EQSlider
          label="Mid Q"
          value={params.midQ}
          min={0.3}
          max={4}
          step={0.1}
          onChange={(value) => setParam('midQ', value)}
        />
      </div>

      <div className="pedal-switches">
        <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={() => onToggle(pedal.id)}>
          {pedal.enabled ? 'Module On' : 'Module Off'}
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

type EQSliderProps = {
  band?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function EQSlider({ band, label, value, min, max, step = 1, suffix = '', onChange }: EQSliderProps) {
  return (
    <div className="classic-eq-knob-wrap">
      {band ? <span className="classic-eq-band">{band}</span> : null}
      <KnobControl
        className="amp-eq-control classic-eq-knob"
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        suffix={suffix}
        onChange={onChange}
      />
    </div>
  );
}

const readAmpEQParams = (params: Pedal['params']): AmpEQParams => ({
  lowCut: readNumber(params.lowCut, 70, 40, 160),
  bass: readNumber(params.bass, readNumber(params.bassDb, 2, -12, 12), -12, 12),
  mid: readNumber(params.mid, readNumber(params.midDb, -1, -12, 12), -12, 12),
  midFreq: readNumber(params.midFreq, 760, 250, 1500),
  midQ: readNumber(params.midQ, 0.9, 0.3, 4),
  treble: readNumber(params.treble, readNumber(params.trebleDb, 2, -12, 12), -12, 12),
  presence: readNumber(params.presence, readNumber(params.presenceDb, 1, -12, 12), -12, 12),
  level: readNumber(params.level, 72, 0, 100),
});

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const isPresetMatch = (params: AmpEQParams, preset: AmpEQPreset) =>
  Object.entries(preset.params).every(([key, value]) => Math.abs(params[key as keyof AmpEQParams] - value) < 0.001);

const formatToneLabel = (params: AmpEQParams) => {
  if (params.mid <= -4 && params.bass >= 3) {
    return 'Scooped';
  }

  if (params.mid >= 2) {
    return 'Forward mids';
  }

  if (params.presence >= 3) {
    return 'Bright';
  }

  if (params.bass >= 3 && params.treble <= 0) {
    return 'Warm';
  }

  return 'Balanced';
};

const drawEQCurve = (canvas: HTMLCanvasElement, params: AmpEQParams) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 290;
  const height = canvas.clientHeight || 78;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  drawEQGrid(context, width, height);

  context.strokeStyle = '#6d9b22';
  context.lineWidth = 2.5;
  context.beginPath();

  for (let x = 0; x <= width; x += 1) {
    const freq = xToFrequency(x, width);
    const db = calculateApproxResponse(freq, params);
    const y = dbToY(db, height);

    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
  drawEQBandNodes(context, width, height, params);
};

const drawEQGrid = (context: CanvasRenderingContext2D, width: number, height: number) => {
  context.fillStyle = '#151718';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 1;

  [40, 80, 160, 250, 500, 750, 1500, 2200, 4000, 8000, 12000].forEach((frequency) => {
    const x = frequencyToX(frequency, width);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  });

  [-12, -6, 0, 6, 12].forEach((db) => {
    const y = dbToY(db, height);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  });

  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.font = '10px system-ui';
  context.fillText('20Hz', 5, height * 0.58);
  context.fillText('200Hz', frequencyToX(200, width) + 3, height * 0.58);
  context.fillText('2kHz', frequencyToX(2000, width) + 3, height * 0.58);
  context.fillText('20kHz', width - 42, height * 0.58);
  context.fillText('+20dB', width / 2 + 8, 16);
  context.fillText('0', 8, dbToY(0, height) - 4);
  context.fillText('-20dB', width / 2 + 8, height - 12);
};

const drawEQBandNodes = (context: CanvasRenderingContext2D, width: number, height: number, params: AmpEQParams) => {
  const nodes = [
    { label: '1', frequency: params.lowCut, db: calculateApproxResponse(params.lowCut, params) + 7 },
    { label: '2', frequency: 135, db: params.bass },
    { label: '3', frequency: params.midFreq, db: params.mid },
    { label: '4', frequency: 2700, db: params.treble },
    { label: '5', frequency: 4300, db: params.presence },
    { label: '6', frequency: 8000, db: params.presence * 0.35 },
  ];

  context.save();
  context.font = 'bold 13px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  nodes.forEach((node) => {
    const x = frequencyToX(node.frequency, width);
    const y = Math.max(18, Math.min(height - 18, dbToY(node.db, height) - 18));
    context.beginPath();
    context.arc(x, y, 15, 0, Math.PI * 2);
    context.fillStyle = 'rgba(109, 155, 34, 0.24)';
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = '#6d9b22';
    context.stroke();
    context.fillStyle = '#b8dc5f';
    context.fillText(node.label, x, y);
  });

  context.restore();
};

const calculateApproxResponse = (frequency: number, params: AmpEQParams) => {
  const lowCutLoss = -18 / (1 + Math.exp((frequency - params.lowCut) / 18));
  const bass = params.bass * shelfWeight(frequency, 135, false);
  const mid = params.mid * bellWeight(frequency, params.midFreq, params.midQ);
  const treble = params.treble * shelfWeight(frequency, 2700, true);
  const presence = params.presence * bellWeight(frequency, 4300, 0.75);
  const level = -24 + (params.level / 100) * 30;
  return Math.min(18, Math.max(-24, lowCutLoss + bass + mid + treble + presence + level * 0.18));
};

const shelfWeight = (frequency: number, corner: number, high: boolean) => {
  const distance = Math.log2(frequency / corner);
  const weight = 1 / (1 + Math.exp((high ? -1 : 1) * distance * 2.6));
  return weight;
};

const bellWeight = (frequency: number, center: number, q: number) => {
  const distance = Math.log2(frequency / center);
  const width = Math.max(0.18, 1.25 / q);
  return Math.exp(-0.5 * (distance / width) ** 2);
};

const frequencyToX = (frequency: number, width: number) => {
  const min = Math.log10(40);
  const max = Math.log10(12000);
  return ((Math.log10(frequency) - min) / (max - min)) * width;
};

const xToFrequency = (x: number, width: number) => {
  const min = Math.log10(40);
  const max = Math.log10(12000);
  return 10 ** (min + (x / width) * (max - min));
};

const dbToY = (db: number, height: number) => {
  const clamped = Math.min(18, Math.max(-24, db));
  return height - ((clamped + 24) / 42) * height;
};

export default AmpEQPedal;
