import { useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

type ExpressionPedalProps = {
  value: number;
  targetLabel?: string;
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function ExpressionPedal({ value, targetLabel = 'MASTER', onChange }: ExpressionPedalProps) {
  const [dragging, setDragging] = useState(false);
  const safeValue = clamp(value, 0, 100);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    onChange(Math.round(ratio * 100));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromPointer(event);
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
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
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
