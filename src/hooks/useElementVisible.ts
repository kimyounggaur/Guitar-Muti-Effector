import { useEffect, useRef, useState } from 'react';

/** Subscribe to expensive live meters only while their panel is on screen. */
export function useElementVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let intersecting = typeof IntersectionObserver === 'undefined';
    const update = () => setVisible(intersecting && document.visibilityState !== 'hidden');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      intersecting = entries.some((entry) => entry.isIntersecting);
      update();
    });
    observer?.observe(element);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return [ref, visible] as const;
}
