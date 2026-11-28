import { type CSSProperties, useEffect, useState } from 'react';
import { subscribeCompressorReduction } from '../../../audio/nodes/CompressorEffect';
import type { Pedal, PedalParamValue } from '../../../audio/types';
import { useElementVisible } from '../../../hooks/useElementVisible';
import { clampNumber, percentFromRange, readNumberParam } from '../common/paramFormat';
import '../../../styles/components/rack-compressor.css';
import { t } from '../../../i18n/ko';

type CompressorRackPanelProps = {
  pedal: Pedal;
  onToggle: () => void;
  onBypass: () => void;
  onParamChange: (paramName: string, value: PedalParamValue) => void;
};

export default function CompressorRackPanel({ pedal, onToggle, onBypass, onParamChange }: CompressorRackPanelProps) {
  const [liveReduction, setLiveReduction] = useState(0);
  const [meterRef, meterVisible] = useElementVisible<HTMLDivElement>();
  const threshold = readNumberParam(pedal.params.threshold, -28, -60, -10);
  const ratio = readNumberParam(pedal.params.ratio, 3.5, 1, 20);
  const attack = readNumberParam(pedal.params.attack, 0.012, 0.001, 0.1);
  const release = readNumberParam(pedal.params.release, 0.22, 0.05, 1);
  const knee = readNumberParam(pedal.params.knee, 18, 0, 40);
  const sustain = readNumberParam(pedal.params.sustain, 42, 0, 100);
  const mix = readNumberParam(pedal.params.mix, 78, 0, 100);
  const level = readNumberParam(pedal.params.level, 72, 0, 100);
  const isLimitMode = ratio >= 8;
  const meterReduction = clampNumber(Math.abs(liveReduction), 0, 24);
  const needleAngle = -38 + percentFromRange(meterReduction, 0, 24) * 0.76;

  useEffect(() => {
    if (!meterVisible) {
      setLiveReduction(0);
      return;
    }
    return subscribeCompressorReduction(pedal.id, setLiveReduction);
  }, [pedal.id, meterVisible]);

  return (
    <div ref={meterRef} className={`comp-rack-module ${pedal.enabled && !pedal.bypassed ? 'is-online' : ''}`}>
      <span className="comp-rack-rack-ear is-left" aria-hidden="true" />
      <span className="comp-rack-rack-ear is-right" aria-hidden="true" />
      <span className="comp-rack-screw is-top-left" aria-hidden="true" />
      <span className="comp-rack-screw is-top-right" aria-hidden="true" />
      <span className="comp-rack-screw is-bottom-left" aria-hidden="true" />
      <span className="comp-rack-screw is-bottom-right" aria-hidden="true" />

      <div className="comp-rack-brand">
        <strong>{t('panel.compressor.lettering1')}</strong>
        <i aria-hidden="true" />
      </div>

      <div className="comp-rack-model-plate">
        <span>{t('panel.compressor.lettering2')}</span>
        <strong>{t('panel.compressor.lettering3')}</strong>
      </div>

      <CompressorRackKnob label="Gain" value={level} min={0} max={100} step={1} onChange={(value) => onParamChange('level', value)} />

      <div className="comp-rack-vu-meter" aria-label={t('panel.compressor.grLabel', { value: Math.round(meterReduction) })}>
        <span>GR</span>
        <em>{t('panel.compressor.grCaption')}</em>
        <div className="comp-rack-vu-scale" aria-hidden="true">
          <b>0</b>
          <b>−8</b>
          <b>−16</b>
          <b>−24</b>
        </div>
        <i className="comp-rack-vu-needle" style={{ '--comp-rack-needle-angle': `${needleAngle}deg` } as CSSProperties} aria-hidden="true" />
        <strong>{t('panel.compressor.lettering1')}</strong>
      </div>

      <CompressorRackKnob
        label={t('panel.compressor.peakReductionLettering')}
        value={sustain}
        min={0}
        max={100}
        step={1}
        onChange={(value) => onParamChange('sustain', value)}
      />

      <div className="comp-rack-switch-bank">
        <button
          type="button"
          className={`comp-rack-limit-switch ${isLimitMode ? 'is-limit' : ''}`}
          onClick={() => onParamChange('ratio', isLimitMode ? 3.5 : 12)}
          aria-pressed={isLimitMode}
        >
          <span>{t('panel.compressor.compress')}</span>
          <i aria-hidden="true" />
          <span>{t('panel.compressor.limit')}</span>
        </button>

        <button type="button" className={`comp-rack-power ${pedal.enabled ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={pedal.enabled}>
          <i aria-hidden="true" />
          <span>{t('panel.compressor.power')}</span>
        </button>

        <button type="button" className={`comp-rack-bypass ${pedal.bypassed ? 'is-bypassed' : ''}`} onClick={onBypass} aria-pressed={pedal.bypassed}>
          {pedal.bypassed ? t('panel.common.bypassLettering') : t('panel.compressor.inLine')}
        </button>
      </div>

      <div className="comp-rack-trim-strip">
        <CompressorTrim
          label="Threshold"
          value={threshold}
          min={-60}
          max={-10}
          step={1}
          suffix="dB"
          onChange={(value) => onParamChange('threshold', value)}
        />
        <CompressorTrim
          label="Attack"
          value={attack * 1000}
          min={1}
          max={100}
          step={1}
          suffix="ms"
          onChange={(value) => onParamChange('attack', value / 1000)}
        />
        <CompressorTrim label="Release" value={release} min={0.05} max={1} step={0.01} suffix="s" onChange={(value) => onParamChange('release', value)} />
        <CompressorTrim label="Knee" value={knee} min={0} max={40} step={1} suffix="dB" onChange={(value) => onParamChange('knee', value)} />
        <CompressorTrim label="Mix" value={mix} min={0} max={100} step={1} suffix="%" onChange={(value) => onParamChange('mix', value)} />
      </div>
    </div>
  );
}

type CompressorRackKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function CompressorRackKnob({ label, value, min, max, step, onChange }: CompressorRackKnobProps) {
  const clamped = clampNumber(value, min, max);
  const fill = percentFromRange(clamped, min, max);
  const angle = -135 + (fill / 100) * 270;

  return (
    <label className="comp-rack-knob" style={{ '--comp-rack-knob-angle': `${angle}deg` } as CSSProperties}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={clamped} onChange={(event) => onChange(Number(event.target.value))} />
      <i aria-hidden="true" />
      <strong>{Math.round(clamped)}</strong>
    </label>
  );
}

type CompressorTrimProps = CompressorRackKnobProps & {
  suffix: string;
};

function CompressorTrim({ label, value, min, max, step, suffix, onChange }: CompressorTrimProps) {
  const clamped = clampNumber(value, min, max);
  const fill = percentFromRange(clamped, min, max);

  return (
    <label className="comp-rack-trim" style={{ '--comp-rack-trim-fill': `${fill}%` } as CSSProperties}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={clamped} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>
        {Math.round(clamped * 100) / 100}
        {suffix}
      </strong>
    </label>
  );
}
