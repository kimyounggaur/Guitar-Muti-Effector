// WCAG 2.x contrast helpers. Each function is self-contained so it can also be
// serialised with Function.prototype.toString and injected into the page.
export type Rgba = [number, number, number, number];

export function parseColor(value: string): Rgba | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

export function relativeLuminance(color: Rgba): number {
  const ch = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(color[0]) + 0.7152 * ch(color[1]) + 0.0722 * ch(color[2]);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const lum = (color: Rgba) => {
    const ch = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(color[0]) + 0.7152 * ch(color[1]) + 0.0722 * ch(color[2]);
  };
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composite a translucent colour over an opaque background. */
export function blend(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

export const contrastBrowserScript = () =>
  `window.__contrast = { parseColor: ${parseColor.toString()}, contrastRatio: ${contrastRatio.toString()}, blend: ${blend.toString()} };`;
