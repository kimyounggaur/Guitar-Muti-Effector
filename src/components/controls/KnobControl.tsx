import { useMemo, useRef, useState } from 'react';
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
  const dragOrigin = useRef<{ y: number; value: number } | null>(null);
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

  // Relative vertical dragging avoids the discontinuity at the bottom of a dial.
  // Touch users can scroll normally and use the accessible +/- controls below.
  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    commit(origin.value + ((origin.y - event.clientY) / 160) * (max - min));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType === 'touch' || event.button !== 0) return;
    dragOrigin.current = { y: event.clientY, value: safeValue };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const endDrag = () => {
    dragOrigin.current = null;
    setDragging(false);
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
    <div className={`knob-control ${className} ${disabled ? 'is-disabled' : ''}`}>
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
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
      >
        <i aria-hidden="true" />
      </div>
      <strong>
        {formattedValue}
        {suffix}
      </strong>
      <div className="knob-adjust" aria-label={`${label} 값 조절`}>
        <button type="button" disabled={disabled || safeValue <= min} aria-label={`${label} 줄이기`} onClick={() => commit(safeValue - step)}>−</button>
        <button type="button" disabled={disabled || safeValue >= max} aria-label={`${label} 늘리기`} onClick={() => commit(safeValue + step)}>+</button>
      </div>
    </div>
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
