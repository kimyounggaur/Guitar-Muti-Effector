import { useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

type KnobControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function KnobControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  disabled = false,
  className = '',
  formatValue: formatValueProp,
  onChange,
}: KnobControlProps) {
  const [dragging, setDragging] = useState(false);
  const safeValue = clamp(Number.isFinite(value) ? value : min, min, max);
  const ratio = max === min ? 0 : (safeValue - min) / (max - min);
  const angle = -135 + ratio * 270;
  const formattedValue = useMemo(
    () => (formatValueProp ? formatValueProp(safeValue) : formatNumberValue(safeValue, step)),
    [formatValueProp, safeValue, step],
  );

  const commit = (nextValue: number) => {
    if (disabled) {
      return;
    }

    const stepped = Math.round(nextValue / step) * step;
    onChange(Number(clamp(stepped, min, max).toFixed(getPrecision(step))));
  };

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radians = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const degrees = radians * (180 / Math.PI);
    const normalized = clamp((degrees + 225) / 270, 0, 1);
    commit(min + normalized * (max - min));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromPointer(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const largeStep = step * 10;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      commit(safeValue + step);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      commit(safeValue - step);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      commit(safeValue + largeStep);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      commit(safeValue - largeStep);
    } else if (event.key === 'Home') {
      event.preventDefault();
      commit(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      commit(max);
    }
  };

  return (
    <label className={`knob-control ${className} ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <div
        className={`knob-face ${dragging ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        aria-valuetext={`${formattedValue}${suffix}`}
        style={{ '--knob-angle': `${angle}deg`, '--knob-fill': `${ratio * 100}%` } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => dragging && updateFromPointer(event)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={handleKeyDown}
      >
        <i aria-hidden="true" />
      </div>
      <strong>
        {formattedValue}
        {suffix}
      </strong>
    </label>
  );
}

const getPrecision = (step: number) => {
  const decimals = step.toString().split('.')[1];
  return decimals ? decimals.length : 0;
};

const formatNumberValue = (value: number, step: number) => {
  if (step < 0.01) {
    return value.toFixed(3);
  }

  if (step < 1) {
    return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  }

  return Math.round(value).toString();
};

export default KnobControl;
