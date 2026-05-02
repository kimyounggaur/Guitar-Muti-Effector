import { useEffect, useMemo, useRef, useState } from 'react';
import { CabinetMic, CabinetType, registerCustomCabinetIR } from '../../audio/nodes/CabinetIREffect';
import { Pedal, PedalParamValue } from '../../audio/types';
import KnobControl from '../controls/KnobControl';

type CabinetIRParams = {
  cabinetType: CabinetType;
  mic: CabinetMic;
  lowCut: number;
  highCut: number;
  mix: number;
  level: number;
  customIRName: string;
};

type CabinetIRPedalProps = {
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

function CabinetIRPedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: CabinetIRPedalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [uploadName, setUploadName] = useState('');
  const params = useMemo(() => readCabinetIRParams(pedal.params), [pedal.params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    drawCabinetCurve(canvas, params);
  }, [params]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  const handleIRUpload = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const data = await file.arrayBuffer();
    const token = registerCustomCabinetIR(pedal.id, file.name, data);
    setUploadName(file.name);
    setParam('cabinetType', 'custom');
    setParam('customIRName', token);
  };

  return (
    <article
      className={`pedal-card cabinet-ir-pedal ${selected ? 'is-selected' : ''} ${
        pedal.enabled ? 'is-on' : 'is-off'
      } ${isDragging ? 'is-dragging' : ''}`}
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
        <button type="button" className="pedal-select cabinet-display" onClick={() => onSelect(pedal.id)}>
          <span>Speaker cabinet</span>
          <strong>CAB IR</strong>
          <em>{formatCabinetLabel(params)}</em>
        </button>
      </div>

      <canvas ref={canvasRef} className="cabinet-curve-canvas" width="580" height="146" aria-label="Cabinet filter curve" />

      <div className="cabinet-row">
        <label className="cabinet-control is-wide">
          <span>Cabinet</span>
          <select value={params.cabinetType} onChange={(event) => setParam('cabinetType', event.target.value)}>
            <option value="1x12">1x12</option>
            <option value="2x12">2x12</option>
            <option value="4x12">4x12</option>
            <option value="openBack">Open Back</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="cabinet-control is-wide">
          <span>Mic</span>
          <select value={params.mic} onChange={(event) => setParam('mic', event.target.value)}>
            <option value="dynamic">Dynamic</option>
            <option value="ribbon">Ribbon</option>
            <option value="condenser">Condenser</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
      </div>

      <label className="ir-upload">
        <span>IR File</span>
        <input
          type="file"
          accept="audio/wav,audio/wave,.wav"
          onChange={(event) => void handleIRUpload(event.target.files?.[0])}
        />
        <strong>{uploadName || params.customIRName.split(':')[0] || 'Synthetic / bundled'}</strong>
      </label>

      <div className="cabinet-controls">
        <CabSlider
          label="LowCut"
          value={params.lowCut}
          min={40}
          max={200}
          suffix="Hz"
          onChange={(value) => setParam('lowCut', value)}
        />
        <CabSlider
          label="HighCut"
          value={params.highCut}
          min={3000}
          max={12000}
          step={100}
          suffix="Hz"
          onChange={(value) => setParam('highCut', value)}
        />
        <CabSlider label="Mix" value={params.mix} min={0} max={100} onChange={(value) => setParam('mix', value)} />
        <CabSlider label="Level" value={params.level} min={0} max={100} onChange={(value) => setParam('level', value)} />
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

type CabSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function CabSlider({ label, value, min, max, step = 1, suffix = '', onChange }: CabSliderProps) {
  return (
    <KnobControl
      className="cabinet-control"
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

const readCabinetIRParams = (params: Pedal['params']): CabinetIRParams => ({
  cabinetType: readCabinetType(params.cabinetType ?? params.cabinet),
  mic: readMic(params.mic),
  lowCut: readNumber(params.lowCut, 80, 40, 200),
  highCut: readNumber(params.highCut, 6500, 3000, 12000),
  mix: readNumber(params.mix, 100, 0, 100),
  level: readNumber(params.level, 72, 0, 100),
  customIRName: typeof params.customIRName === 'string' ? params.customIRName : '',
});

const readCabinetType = (value: PedalParamValue | undefined): CabinetType => {
  if (value === '1x12' || value === '2x12' || value === '4x12' || value === 'openBack' || value === 'custom') {
    return value;
  }

  if (typeof value === 'string' && value.includes('1x12')) {
    return '1x12';
  }

  if (typeof value === 'string' && value.includes('4x12')) {
    return '4x12';
  }

  return '2x12';
};

const readMic = (value: PedalParamValue | undefined): CabinetMic => {
  if (value === 'dynamic' || value === 'ribbon' || value === 'condenser' || value === 'mixed') {
    return value;
  }

  return 'dynamic';
};

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  const normalized = max === 100 && numberValue > 0 && numberValue <= 1 ? numberValue * 100 : numberValue;
  return Math.min(max, Math.max(min, normalized));
};

const formatCabinetLabel = (params: CabinetIRParams) => {
  const cabinet = params.cabinetType === 'openBack' ? 'Open Back' : params.cabinetType;
  return `${cabinet} / ${params.mic}`;
};

const drawCabinetCurve = (canvas: HTMLCanvasElement, params: CabinetIRParams) => {
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
  drawCabinetGrid(context, width, height);

  context.strokeStyle = '#ffcf6d';
  context.lineWidth = 2.5;
  context.beginPath();

  for (let x = 0; x <= width; x += 1) {
    const frequency = xToFrequency(x, width);
    const db = approximateCabinetResponse(frequency, params);
    const y = dbToY(db, height);

    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
};

const drawCabinetGrid = (context: CanvasRenderingContext2D, width: number, height: number) => {
  context.fillStyle = '#0a0d0c';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 1;

  [80, 160, 750, 3000, 6500, 10000].forEach((frequency) => {
    const x = frequencyToX(frequency, width);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  });

  [-24, -12, 0, 6].forEach((db) => {
    const y = dbToY(db, height);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  });

  context.fillStyle = 'rgba(255, 255, 255, 0.45)';
  context.font = '10px system-ui';
  context.fillText('80', frequencyToX(80, width) + 3, height - 8);
  context.fillText('3k', frequencyToX(3000, width) + 3, height - 8);
  context.fillText('10k', frequencyToX(10000, width) - 22, height - 8);
  context.fillText('0', 8, dbToY(0, height) - 4);
};

const approximateCabinetResponse = (frequency: number, params: CabinetIRParams) => {
  const lowCut = -24 / (1 + Math.exp((frequency - params.lowCut) / 20));
  const highCut = -30 / (1 + Math.exp((params.highCut - frequency) / 900));
  const body = cabinetBodyGain(frequency, params.cabinetType);
  const mic = micPresenceGain(frequency, params.mic);
  const level = -24 + (params.level / 100) * 30;
  return Math.max(-30, Math.min(9, lowCut + highCut + body + mic + level * 0.12));
};

const cabinetBodyGain = (frequency: number, cabinetType: CabinetType) => {
  const center = cabinetType === '1x12' ? 165 : cabinetType === '4x12' ? 125 : cabinetType === 'openBack' ? 210 : 145;
  const bassLift = cabinetType === '4x12' ? 5 : cabinetType === '1x12' ? 2.5 : 3.5;
  const lowBump = bassLift * Math.exp(-0.5 * (Math.log2(frequency / center) / 0.72) ** 2);
  const coneDip = -3.5 * Math.exp(-0.5 * (Math.log2(frequency / 3600) / 0.44) ** 2);
  return lowBump + coneDip;
};

const micPresenceGain = (frequency: number, mic: CabinetMic) => {
  const brightness = mic === 'ribbon' ? -2.5 : mic === 'condenser' ? 3.5 : mic === 'mixed' ? 1.5 : 0.5;
  return brightness * Math.exp(-0.5 * (Math.log2(frequency / 5200) / 0.78) ** 2);
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
  const clamped = Math.max(-30, Math.min(9, db));
  return height - ((clamped + 30) / 39) * height;
};

export default CabinetIRPedal;
