import { PedalParamDefinition } from '../../audio/types';

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  output: string;
  className?: string;
  onChange: (value: number) => void;
};

export const formatParamValue = (definition: PedalParamDefinition, value: number) => {
  if (definition.kind === 'db') {
    return `${value > 0 ? '+' : ''}${value.toFixed(value % 1 === 0 ? 0 : 1)} dB`;
  }

  if (definition.kind === 'ms') {
    return `${Math.round(value)} ms`;
  }

  if (definition.kind === 'hz') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
  }

  if (definition.kind === 'percent') {
    return `${Math.round(value * 100)}%`;
  }

  if (definition.key === 'ratio') {
    return `${value.toFixed(value % 1 === 0 ? 0 : 1)}:1`;
  }

  return `${value.toFixed(1)}x`;
};

function SliderControl({ label, value, min, max, step, output, className, onChange }: SliderControlProps) {
  return (
    <label className={`slider-row ${className ?? ''}`}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{output}</output>
    </label>
  );
}

export default SliderControl;
