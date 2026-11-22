import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import '../../styles/components/expression.css';
import { t } from '../../i18n/ko';

type ExpressionPedalProps = {
  value: number;
  targetLabel?: string;
  /** Current master volume in %, shown as the ceiling of the volume pedal. */
  masterPercent?: number;
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function ExpressionPedal({ value, targetLabel = 'VOLUME', masterPercent, onChange }: ExpressionPedalProps) {
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{ x: number; y: number; value: number } | null>(null);
  const safeValue = clamp(value, 0, 100);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // The phone layout draws the pedal as a horizontal bar: drag sideways there, up and down elsewhere.
    const horizontal = rect.width > rect.height * 2;
    const distance = Math.max(horizontal ? rect.width : rect.height, 160);
    const moved = horizontal ? event.clientX - origin.x : origin.y - event.clientY;
    onChange(Math.round(clamp(origin.value + (moved / distance) * 100, 0, 100)));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, value: safeValue };
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
    <section className="expression-pedal-wrap" aria-label={t('panel.expression.region')}>
      <div
        className={`expression-pedal ${dragging ? 'is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={t('panel.expression.slider', { target: targetLabel })}
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
        <span>{t('panel.expression.lettering')}</span>
        <strong>{targetLabel}</strong>
        <small>{safeValue}%</small>
        {masterPercent !== undefined ? <small className="expression-ceiling">{t('panel.expression.ceiling', { percent: masterPercent })}</small> : null}
      </div>
    </section>
  );
}

export default ExpressionPedal;
