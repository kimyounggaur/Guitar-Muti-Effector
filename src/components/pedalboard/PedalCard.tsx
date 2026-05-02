import { CSSProperties, useEffect, useRef } from 'react';
import { EffectDefinition, Pedal, PedalPatch, getEffectDefinition } from '../../audio/types';
import { clamp } from '../../audio/utils/curves';
import FootSwitch from '../controls/FootSwitch';
import SliderControl, { formatParamValue } from '../controls/SliderControl';

export type PedalCardProps = {
  index: number;
  pedal: Pedal;
  dragHandle?: {
    attributes: Record<string, unknown>;
    listeners?: Record<string, unknown>;
  };
  isDragging?: boolean;
  style?: CSSProperties;
  onPatch: (pedalId: string, patch: PedalPatch) => void;
  onParam: (pedalId: string, key: string, value: number) => void;
};

function PedalCard({ index, pedal, dragHandle, isDragging = false, style, onPatch, onParam }: PedalCardProps) {
  const definition = getEffectDefinition(pedal.type);
  const active = pedal.enabled && !pedal.bypassed;
  const cardStyle = {
    ...style,
    '--pedal-accent': definition.accent,
  } as CSSProperties;

  return (
    <article className={`pedal-card ${active ? 'is-active' : 'is-muted'} ${isDragging ? 'is-dragging' : ''}`} style={cardStyle}>
      <div className="pedal-top">
        <button
          className="drag-handle"
          type="button"
          aria-label={`Move ${pedal.label}`}
          {...dragHandle?.attributes}
          {...dragHandle?.listeners}
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <span className="pedal-index">{String(index + 1).padStart(2, '0')}</span>
          <h3>{pedal.label}</h3>
          <p>{definition.description}</p>
        </div>
      </div>

      <PedalFace definition={definition} pedal={pedal} />

      <div className="pedal-actions" aria-label={`${pedal.label} state`}>
        <FootSwitch label={pedal.enabled ? 'On' : 'Off'} active={pedal.enabled} onClick={() => onPatch(pedal.id, { enabled: !pedal.enabled })} />
        <FootSwitch
          label={pedal.bypassed ? 'Bypassed' : 'Bypass'}
          active={pedal.bypassed}
          variant="warning"
          onClick={() => onPatch(pedal.id, { bypassed: !pedal.bypassed })}
        />
      </div>

      <div className="pedal-sliders">
        <SliderControl
          label="Mix"
          min={0}
          max={1}
          step={0.01}
          value={pedal.mix}
          output={`${Math.round(pedal.mix * 100)}%`}
          onChange={(value) => onPatch(pedal.id, { mix: value })}
        />
        <SliderControl
          label="Level"
          min={0}
          max={1.5}
          step={0.01}
          value={pedal.level}
          output={`${Math.round(pedal.level * 100)}%`}
          onChange={(value) => onPatch(pedal.id, { level: value })}
        />
        {definition.params.map((param) => {
          const value = pedal.params[param.key] ?? param.defaultValue;
          return (
            <SliderControl
              key={param.key}
              label={param.label}
              min={param.min}
              max={param.max}
              step={param.step}
              value={value}
              output={formatParamValue(param, value)}
              onChange={(nextValue) => onParam(pedal.id, param.key, nextValue)}
            />
          );
        })}
      </div>
    </article>
  );
}

function PedalFace({ definition, pedal }: { definition: EffectDefinition; pedal: Pedal }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(220, rect.width || 220);
    const height = Math.max(96, rect.height || 96);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#151817';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(255,255,255,0.08)';
    context.lineWidth = 1;
    for (let x = 16; x < width; x += 22) {
      context.beginPath();
      context.moveTo(x, 12);
      context.lineTo(x, height - 12);
      context.stroke();
    }

    context.strokeStyle = definition.accent;
    context.fillStyle = definition.accent;
    context.lineWidth = 2.5;
    context.globalAlpha = pedal.enabled && !pedal.bypassed ? 1 : 0.32;

    drawEffectGlyph(context, definition.type, width, height);

    context.globalAlpha = 0.18;
    context.fillRect(0, height - 6, width * pedal.mix, 6);
    context.globalAlpha = 1;
  }, [definition, pedal.bypassed, pedal.enabled, pedal.mix]);

  return (
    <div className="pedal-face" aria-hidden="true">
      <canvas ref={canvasRef} />
      <span>{definition.shortLabel}</span>
    </div>
  );
}

function drawEffectGlyph(context: CanvasRenderingContext2D, type: Pedal['type'], width: number, height: number) {
  if (type === 'ampEq') {
    const bars = [0.52, 0.38, 0.66, 0.46];
    bars.forEach((bar, index) => {
      const x = 34 + index * 44;
      context.fillRect(x, height * (1 - bar), 18, height * bar - 20);
    });
    return;
  }

  if (type === 'cabinet') {
    context.strokeRect(36, 24, width - 72, height - 44);
    for (let x = 52; x < width - 48; x += 16) {
      context.beginPath();
      context.moveTo(x, 28);
      context.lineTo(x - 16, height - 24);
      context.stroke();
    }
    context.beginPath();
    context.arc(width * 0.5, height * 0.53, 19, 0, Math.PI * 2);
    context.stroke();
    return;
  }

  if (type === 'delay') {
    [0.88, 0.58, 0.36, 0.22].forEach((scale, index) => {
      context.globalAlpha = scale;
      context.beginPath();
      context.arc(54 + index * 42, height * 0.52, 14 + index * 2, 0, Math.PI * 2);
      context.stroke();
    });
    context.globalAlpha = 1;
    return;
  }

  if (type === 'reverb') {
    for (let index = 0; index < 5; index += 1) {
      context.globalAlpha = 0.95 - index * 0.13;
      context.beginPath();
      context.arc(width * 0.5, height * 0.78, 24 + index * 15, Math.PI * 1.1, Math.PI * 1.9);
      context.stroke();
    }
    context.globalAlpha = 1;
    return;
  }

  context.beginPath();
  for (let x = 18; x < width - 18; x += 4) {
    const phase = (x / (width - 36)) * Math.PI * 4;
    let y = height * 0.52 + Math.sin(phase) * 22;

    if (type === 'compressor') {
      y = height * 0.52 + Math.sin(phase) * 13;
    }

    if (type === 'drive') {
      y = clamp(y, height * 0.34, height * 0.7);
    }

    if (type === 'noiseGate' && x < width * 0.42) {
      y = height * 0.52;
    }

    if (x === 18) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  if (type === 'noiseGate') {
    context.beginPath();
    context.moveTo(width * 0.42, height * 0.25);
    context.lineTo(width * 0.42, height * 0.78);
    context.stroke();
  }
}

export default PedalCard;
