import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

type ExpressionPedalProps = {
  value: number;
  targetLabel?: string;
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function ExpressionPedal({ value, targetLabel = 'MASTER', onChange }: ExpressionPedalProps) {
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ y: number; value: number } | null>(null);
  const safeValue = clamp(value, 0, 100);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const distance = Math.max(event.currentTarget.getBoundingClientRect().height, 160);
    onChange(Math.round(clamp(origin.value + ((origin.y - event.clientY) / distance) * 100, 0, 100)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragOrigin.current = { y: event.clientY, value: safeValue };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const endDrag = () => {
    dragOrigin.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      onChange(Math.min(100, safeValue + 1));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onChange(Math.max(0, safeValue - 1));
    }
  };

  return (
    <section className="expression-pedal-wrap" aria-label="Expression pedal">
      <div
        className={`expression-pedal ${dragging ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={`${targetLabel} expression`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        style={{ '--expression-value': `${safeValue}%` } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={(event) => dragging && updateFromPointer(event)}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
      >
        <i aria-hidden="true" />
      </div>
      <div className="expression-label">
        <span>EXP PEDAL</span>
        <strong>{targetLabel}</strong>
        <small>{safeValue}%</small>
      </div>
    </section>
  );
}

export default ExpressionPedal;
