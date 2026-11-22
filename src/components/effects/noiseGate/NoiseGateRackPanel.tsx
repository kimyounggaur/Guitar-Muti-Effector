import type { CSSProperties } from 'react';
import type { Pedal, PedalParamValue } from '../../../audio/types';
import { clampNumber, percentFromRange, readNumberParam } from '../common/paramFormat';
import '../../../styles/components/rack-noise-gate.css';
import { t } from '../../../i18n/ko';

type NoiseGateRackPanelProps = {
  pedal: Pedal;
  onToggle: () => void;
  onBypass: () => void;
  onParamChange: (paramName: string, value: PedalParamValue) => void;
};

export default function NoiseGateRackPanel({ pedal, onToggle, onBypass, onParamChange }: NoiseGateRackPanelProps) {
  const threshold = readNumberParam(pedal.params.thresholdDb, -48, -60, -10);
  const attack = readNumberParam(pedal.params.attackMs, 8, 1, 200);
  const hold = readNumberParam(pedal.params.holdMs, 80, 0, 1000);
  const release = readNumberParam(pedal.params.releaseMs, 180, 20, 500);
  const thresholdPercent = percentFromRange(threshold, -60, -10);
  const sensitivity = Math.round(thresholdPercent);
  const gateState = pedal.enabled && !pedal.bypassed ? 'ONLINE' : pedal.bypassed ? 'BYPASS' : 'OFFLINE';
  const hardMode = threshold >= -42;

  return (
    <div className={`noise-rack-module ${pedal.enabled && !pedal.bypassed ? 'is-online' : ''}`}>
      <span className="noise-rack-screw is-top-left" aria-hidden="true" />
      <span className="noise-rack-screw is-top-right" aria-hidden="true" />
      <span className="noise-rack-screw is-bottom-left" aria-hidden="true" />
      <span className="noise-rack-screw is-bottom-right" aria-hidden="true" />

      <div className="noise-rack-threshold">
        <div className="noise-rack-meter-scale" aria-hidden="true">
          {[100, 80, 60, 40, 20, 0].map((mark) => (
            <span key={mark}>{mark}</span>
          ))}
        </div>
        <label className="noise-rack-fader">
          <span>{t('param.noiseGate.thresholdDb')}</span>
          <input
            type="range"
            min="-60"
            max="-10"
            step="1"
            value={threshold}
            onChange={(event) => onParamChange('thresholdDb', Number(event.target.value))}
            aria-label={t('panel.noiseGate.thresholdLabel')}
            style={{ '--noise-fader-fill': `${thresholdPercent}%` } as CSSProperties}
          />
          <strong>{Math.round(threshold)}dB</strong>
        </label>
      </div>

      <div className="noise-rack-brand">
        <span>{t('panel.noiseGate.lettering1')}</span>
        <strong>{t('panel.noiseGate.lettering2')}</strong>
      </div>

      <div className="noise-rack-status" aria-label={t('panel.noiseGate.status', { state: gateState })}>
        <span className={pedal.enabled && !pedal.bypassed ? 'is-lit' : ''}>
          <i aria-hidden="true" />
          
          {t('panel.noiseGate.online')}
        </span>
        <span className={pedal.bypassed || !pedal.enabled ? 'is-lit is-bypass' : ''}>
          <i aria-hidden="true" />
          
          {t('panel.common.bypassLettering')}
        </span>
      </div>

      <button type="button" className={`noise-rack-auto ${pedal.enabled ? 'is-on' : ''}`} onClick={onToggle}>
        <i aria-hidden="true">ON</i>
        <span>{t('panel.noiseGate.enable')}</span>
        <strong>{pedal.enabled ? t('panel.common.on') : t('panel.common.off')}</strong>
      </button>

      <div className="noise-rack-knobs">
        <RackDial
          label="Attack"
          value={attack}
          min={1}
          max={200}
          step={1}
          suffix="ms"
          onChange={(value) => onParamChange('attackMs', value)}
        />
        <RackDial
          label="Hold"
          value={hold}
          min={0}
          max={1000}
          step={1}
          suffix="ms"
          onChange={(value) => onParamChange('holdMs', value)}
        />
        <RackDial
          label="릴리스"
          value={release}
          min={20}
          max={500}
          step={5}
          suffix="ms"
          onChange={(value) => onParamChange('releaseMs', value)}
        />
      </div>

      <aside className="noise-easy-gate" aria-label={t('panel.noiseGate.quick')}>
        <span className="noise-easy-pin is-left" aria-hidden="true" />
        <span className="noise-easy-pin is-right" aria-hidden="true" />
        <div className="noise-easy-title">{t('panel.noiseGate.lettering3')}</div>
        <RackDial
          label="Sensitivity"
          value={sensitivity}
          min={0}
          max={100}
          step={1}
          suffix=""
          onChange={(value) => onParamChange('thresholdDb', -60 + (value / 100) * 50)}
        />
        <div className="noise-hard-soft" aria-label={t('panel.noiseGate.hardSoft')}>
          <span>{t('panel.noiseGate.hard')}</span>
          <button
            type="button"
            className={hardMode ? 'is-hard' : ''}
            onClick={() => onParamChange('thresholdDb', hardMode ? -54 : -38)}
            aria-pressed={hardMode}
          >
            <i aria-hidden="true" />
          </button>
          <span>{t('panel.noiseGate.soft')}</span>
          <strong>{Math.round(threshold)}</strong>
        </div>
        <button
          type="button"
          className={`noise-power-slide ${pedal.enabled ? 'is-on' : ''}`}
          onClick={onToggle}
          aria-pressed={pedal.enabled}
        >
          <span>ON</span>
          <i aria-hidden="true" />
          <span>OFF</span>
        </button>
      </aside>
    </div>
  );
}

type RackDialProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
};

function RackDial({ label, value, min, max, step, suffix, onChange }: RackDialProps) {
  const clamped = clampNumber(value, min, max);
  const fill = percentFromRange(clamped, min, max);
  const angle = -135 + (fill / 100) * 270;

  return (
    <label className="noise-rack-dial" style={{ '--noise-dial-angle': `${angle}deg`, '--noise-dial-fill': `${fill}%` } as CSSProperties}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      <i aria-hidden="true" />
      <strong>
        {Math.round(clamped)}
        {suffix}
      </strong>
    </label>
  );
}
