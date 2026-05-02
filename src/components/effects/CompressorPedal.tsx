import { useEffect, useMemo, useState } from 'react';
import { subscribeCompressorReduction } from '../../audio/nodes/CompressorEffect';
import { Pedal, PedalParamValue } from '../../audio/types';
import KnobControl from '../controls/KnobControl';

type CompressorPedalProps = {
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

function CompressorPedal({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: CompressorPedalProps) {
  const [reductionDb, setReductionDb] = useState(0);
  const params = useMemo(() => readCompressorParams(pedal.params), [pedal.params]);
  const reductionAmount = Math.min(30, Math.abs(Math.min(0, reductionDb)));

  useEffect(() => subscribeCompressorReduction(pedal.id, setReductionDb), [pedal.id]);

  const setParam = (name: string, value: PedalParamValue) => onParamChange(pedal.id, name, value);

  return (
    <article
      className={`pedal-card compressor-pedal ${selected ? 'is-selected' : ''} ${
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
        <button type="button" className="pedal-select compressor-display" onClick={() => onSelect(pedal.id)}>
          <span>Dynamics block</span>
          <strong>COMP</strong>
          <em>{Math.round(params.sustain)} Sustain</em>
        </button>
      </div>

      <div className="gain-reduction-meter" aria-label="Gain reduction meter">
        <div className="gain-reduction-header">
          <span>Gain Reduction</span>
          <strong>{reductionAmount.toFixed(1)} dB</strong>
        </div>
        <div className="gain-reduction-track">
          <i style={{ transform: `scaleX(${reductionAmount / 30})` }} />
        </div>
        <div className="gain-reduction-scale">
          <span>0</span>
          <span>-10</span>
          <span>-20</span>
          <span>-30</span>
        </div>
      </div>

      <div className="compressor-controls">
        <CompressorSlider
          label="Sustain"
          value={params.sustain}
          min={0}
          max={100}
          onChange={(value) => setParam('sustain', value)}
        />
        <CompressorSlider
          label="Attack"
          value={params.attack}
          min={0.001}
          max={0.1}
          step={0.001}
          suffix="s"
          onChange={(value) => setParam('attack', value)}
        />
        <CompressorSlider
          label="Release"
          value={params.release}
          min={0.05}
          max={1}
          step={0.01}
          suffix="s"
          onChange={(value) => setParam('release', value)}
        />
        <CompressorSlider label="Mix" value={params.mix} min={0} max={100} onChange={(value) => setParam('mix', value)} />
        <CompressorSlider
          label="Level"
          value={params.level}
          min={0}
          max={100}
          onChange={(value) => setParam('level', value)}
        />
      </div>

      <details className="compressor-advanced">
        <summary>Advanced</summary>
        <CompressorSlider
          label="Threshold"
          value={params.threshold}
          min={-60}
          max={-10}
          suffix="dB"
          onChange={(value) => setParam('threshold', value)}
        />
        <CompressorSlider
          label="Ratio"
          value={params.ratio}
          min={1}
          max={20}
          step={0.1}
          onChange={(value) => setParam('ratio', value)}
        />
        <CompressorSlider
          label="Knee"
          value={params.knee}
          min={0}
          max={40}
          suffix="dB"
          onChange={(value) => setParam('knee', value)}
        />
      </details>

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

type CompressorSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function CompressorSlider({ label, value, min, max, step = 1, suffix = '', onChange }: CompressorSliderProps) {
  return (
    <KnobControl
      className="compressor-control"
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

const readCompressorParams = (params: Pedal['params']) => ({
  threshold: readNumber(params.threshold, readNumber(params.thresholdDb, -28, -60, -10), -60, -10),
  ratio: readNumber(params.ratio, 3.5, 1, 20),
  attack: readNumber(params.attack, 0.012, 0.001, 0.1),
  release: readNumber(params.release, 0.22, 0.05, 1),
  knee: readNumber(params.knee, 18, 0, 40),
  sustain: readNumber(params.sustain, 42, 0, 100),
  mix: readNumber(params.mix, 78, 0, 100),
  level: readNumber(params.level, readLegacyLevel(params.makeupGainDb), 0, 100),
});

const readLegacyLevel = (value: PedalParamValue | undefined) => {
  if (typeof value !== 'number') {
    return 72;
  }

  return Math.min(100, Math.max(0, 50 + value * 2.5));
};

const readNumber = (value: PedalParamValue | undefined, fallback: number, min: number, max: number) => {
  const numberValue = typeof value === 'number' ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
};

export default CompressorPedal;
