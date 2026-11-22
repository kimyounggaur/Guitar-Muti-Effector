// Named scroll targets instead of document.querySelector(...).scrollIntoView.
export type ScrollTargetName = 'board' | 'looper' | 'presets' | 'tuner';

const targets = new Map<ScrollTargetName, HTMLElement>();
const refs = new Map<ScrollTargetName, (element: HTMLElement | null) => void>();

export function registerScrollTarget(name: ScrollTargetName, element: HTMLElement | null) {
  if (element) targets.set(name, element);
  else targets.delete(name);
}

/** Stable callback ref for a target: <section ref={scrollTargetRef('tuner')}>. */
export function scrollTargetRef(name: ScrollTargetName) {
  let ref = refs.get(name);
  if (!ref) {
    ref = (element: HTMLElement | null) => registerScrollTarget(name, element);
    refs.set(name, ref);
  }
  return ref;
}

/** Scrolls smoothly to a target; a <details> target is opened first. */
export function scrollToTarget(name: ScrollTargetName) {
  const element = targets.get(name);
  if (!element) return;
  if (element instanceof HTMLDetailsElement) element.open = true;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
