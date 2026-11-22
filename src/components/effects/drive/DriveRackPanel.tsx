import type { CSSProperties } from 'react';
import type { Pedal, PedalParamValue } from '../../../audio/types';
import { clampNumber, percentFromRange, readNumberParam } from '../common/paramFormat';

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
    <div className={`amp5-drive-module is-${mode} ${pedal.enabled && !pedal.bypassed ? 'is-online' : ''}`}>
      <span className="amp5-corner is-left" aria-hidden="true" />
      <span className="amp5-corner is-right" aria-hidden="true" />

      <div className="amp5-input-strip">
        <span className={`amp5-status-lamp ${pedal.enabled ? 'is-lit' : ''}`} aria-hidden="true" />
        <button type="button" className={`amp5-mini-toggle ${pedal.enabled ? 'is-on' : ''}`} onClick={onToggle} aria-pressed={pedal.enabled}>
          <i aria-hidden="true" />
          <span>ON</span>
        </button>
        <button type="button" className={`amp5-bypass-toggle ${pedal.bypassed ? 'is-bypassed' : ''}`} onClick={onBypass} aria-pressed={pedal.bypassed}>
          <i aria-hidden="true" />
          <span>BYPASS</span>
        </button>
        <span className="amp5-cable-jack" aria-hidden="true" />
      </div>

      <div className="amp5-panel-section amp5-pre-section">
        <DriveRackKnob label="Gain" value={drive} min={0} max={100} step={1} onChange={(value) => onParamChange('drive', value)} />
        <DriveModelSlot label="PRE MODEL" value={modeLabel} onStepDown={() => changeModeBy(-1)} onStepUp={() => changeModeBy(1)} />
      </div>

      <div className="amp5-panel-section amp5-eq-section">
        <DriveRackKnob label="Tone" value={tone} min={0} max={100} step={1} onChange={(value) => onParamChange('tone', value)} />
        <DriveRackKnob label="Bias" value={bias} min={-1} max={1} step={0.01} onChange={(value) => onParamChange('bias', value)} />
        <DriveRackKnob label="Mix" value={mix} min={0} max={100} step={1} onChange={(value) => onParamChange('mix', value)} />
      </div>

      <div className="amp5-panel-section amp5-output-section">
        <DriveRackKnob label="Volume" value={level} min={0} max={100} step={1} onChange={(value) => onParamChange('level', value)} />
        <div className="amp5-match-row">
          <button type="button" className={mix >= 98 ? 'is-matched' : ''} onClick={() => onParamChange('mix', mix >= 98 ? 72 : 100)} aria-pressed={mix >= 98}>
            <i aria-hidden="true" />
            <span>WET 100%</span>
          </button>
          <span className={mix >= 98 ? 'is-lit' : ''} aria-hidden="true" />
        </div>
      </div>

      <div className="amp5-bottom-rail" aria-hidden="true">
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
    <label className="amp5-knob" style={{ '--amp5-knob-angle': `${angle}deg` } as CSSProperties}>
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
    <div className="amp5-model-slot">
      <div>{value}</div>
      <span>{label}</span>
      <button type="button" className="is-up" onClick={onStepUp} aria-label={`${label} next`}>
        <i aria-hidden="true" />
      </button>
      <button type="button" className="is-down" onClick={onStepDown} aria-label={`${label} previous`}>
        <i aria-hidden="true" />
      </button>
    </div>
  );
}
