import type { CSSProperties } from 'react';
import type { Pedal, PedalParamValue } from '../../../audio/types';
import { clampNumber, percentFromRange, readNumberParam } from '../common/paramFormat';
import '../../../styles/components/rack-drive.css';
import { t } from '../../../i18n/ko';

type DriveRackPanelProps = {
  pedal: Pedal;
  onToggle: () => void;
  onBypass: () => void;
  onParamChange: (paramName: string, value: PedalParamValue) => void;
};

const DRIVE_MODE_OPTIONS = [
  ['overdrive', 'British Tube Lead 1'],
  ['crunch', 'Classic Crunch'],
  ['distortion', 'Modern Hi-Gain'],
  ['fuzz', 'Vintage Fuzz Box'],
] as const;

export default function DriveRackPanel({ pedal, onToggle, onBypass, onParamChange }: DriveRackPanelProps) {
  const mode = DRIVE_MODE_OPTIONS.some(([option]) => option === pedal.params.mode) ? String(pedal.params.mode) : 'overdrive';
  const drive = readNumberParam(pedal.params.drive, 48, 0, 100);
  const tone = readNumberParam(pedal.params.tone, 58, 0, 100);
  const level = readNumberParam(pedal.params.level, 72, 0, 100);
  const mix = readNumberParam(pedal.params.mix, 100, 0, 100);
  const bias = readNumberParam(pedal.params.bias, 0, -1, 1);
  const modeIndex = DRIVE_MODE_OPTIONS.findIndex(([option]) => option === mode);
  const modeLabel = DRIVE_MODE_OPTIONS[Math.max(0, modeIndex)]?.[1] ?? 'British Tube Lead 1';

  const changeModeBy = (offset: number) => {
    const nextIndex = (modeIndex + offset + DRIVE_MODE_OPTIONS.length) % DRIVE_MODE_OPTIONS.length;
    onParamChange('mode', DRIVE_MODE_OPTIONS[nextIndex][0]);
  };

  return (
    <div className={`drive-rack-drive-module is-${mode} ${pedal.enabled && !pedal.bypassed ? 'is-online' : ''}`}>
      <span className="drive-rack-corner is-left" aria-hidden="true" />
      <span className="drive-rack-corner is-right" aria-hidden="true" />

      <div className="drive-rack-input-strip">
        <span className={`drive-rack-status-lamp ${pedal.enabled ? 'is-lit' : ''}`} aria-hidden="true" />
        <button type="button" className={`drive-rack-mini-toggle ${pedal.enabled ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={pedal.enabled}>
          <i aria-hidden="true" />
          <span>ON</span>
        </button>
        <button type="button" className={`drive-rack-bypass-toggle ${pedal.bypassed ? 'is-bypassed' : ''}`} onClick={onBypass} aria-pressed={pedal.bypassed}>
          <i aria-hidden="true" />
          <span>BYPASS</span>
        </button>
        <span className="drive-rack-cable-jack" aria-hidden="true" />
      </div>

      <div className="drive-rack-panel-section drive-rack-pre-section">
        <DriveRackKnob label="Gain" value={drive} min={0} max={100} step={1} onChange={(value) => onParamChange('drive', value)} />
        <DriveModelSlot label="PRE MODEL" value={modeLabel} onStepDown={() => changeModeBy(-1)} onStepUp={() => changeModeBy(1)} />
      </div>

      <div className="drive-rack-panel-section drive-rack-eq-section">
        <DriveRackKnob label="Tone" value={tone} min={0} max={100} step={1} onChange={(value) => onParamChange('tone', value)} />
        <DriveRackKnob label={t('panel.drive.biasLettering')} value={bias} min={-1} max={1} step={0.01} onChange={(value) => onParamChange('bias', value)} />
        <DriveRackKnob label="Mix" value={mix} min={0} max={100} step={1} onChange={(value) => onParamChange('mix', value)} />
      </div>

      <div className="drive-rack-panel-section drive-rack-output-section">
        <DriveRackKnob label="Volume" value={level} min={0} max={100} step={1} onChange={(value) => onParamChange('level', value)} />
        <div className="drive-rack-match-row">
          <button type="button" className={mix >= 98 ? 'is-matched' : ''} onClick={() => onParamChange('mix', mix >= 98 ? 72 : 100)} aria-pressed={mix >= 98}>
            <i aria-hidden="true" />
            <span>{t('panel.drive.wet')}</span>
          </button>
          <span className={mix >= 98 ? 'is-lit' : ''} aria-hidden="true" />
        </div>
      </div>

      <div className="drive-rack-bottom-rail" aria-hidden="true">
        <span />
        <span />
      </div>
    </div>
  );
}

type DriveRackKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function DriveRackKnob({ label, value, min, max, step, onChange }: DriveRackKnobProps) {
  const clamped = clampNumber(value, min, max);
  const fill = percentFromRange(clamped, min, max);
  const angle = -138 + (fill / 100) * 276;
  const displayValue = min < 0 ? Math.round(clamped * 100) / 100 : Math.round(clamped);

  return (
    <label className="drive-rack-knob" style={{ '--drive-rack-knob-angle': `${angle}deg` } as CSSProperties}>
      <input type="range" min={min} max={max} step={step} value={clamped} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} />
      <i aria-hidden="true" />
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </label>
  );
}

type DriveModelSlotProps = {
  label: string;
  value: string;
  onStepDown: () => void;
  onStepUp: () => void;
};

function DriveModelSlot({ label, value, onStepDown, onStepUp }: DriveModelSlotProps) {
  return (
    <div className="drive-rack-model-slot">
      <div>{value}</div>
      <span>{label}</span>
      <button type="button" className="is-up" onClick={onStepUp} aria-label={t('panel.drive.next', { label })}>
        <i aria-hidden="true" />
      </button>
      <button type="button" className="is-down" onClick={onStepDown} aria-label={t('panel.drive.previous', { label })}>
        <i aria-hidden="true" />
      </button>
    </div>
  );
}
