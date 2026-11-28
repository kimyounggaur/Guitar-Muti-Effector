export function steppedKnobValue(value: number, min: number, max: number, step: number) {
  const rounded = Math.round(value / step) * step;
  const precision = step.toString().split('.')[1]?.length ?? 0;
  return Math.min(max, Math.max(min, Number(rounded.toFixed(precision))));
}

/** A full-range turn takes 160 vertical pixels. Preserve an off-grid starting value until the drag passes it. */
export function dragKnobValue(start: number, deltaY: number, min: number, max: number, step: number) {
  const origin = Math.min(max, Math.max(min, start));
  if (deltaY === 0) return origin;
  const next = steppedKnobValue(origin - deltaY / 160 * (max - min), min, max, step);
  return deltaY > 0 ? Math.min(origin, next) : Math.max(origin, next);
}
