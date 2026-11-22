import { useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import type { AudioController } from './audioController';

/** Updates the input/output meters at most ~30 times a second while audio runs and the tab is visible. */
export function useMeterLoop(controller: AudioController) {
  const isAudioReady = useAudioStore((state) => state.isAudioReady);
  const setMeters = useAudioStore((state) => state.setMeters);

  useEffect(() => {
    if (!isAudioReady) {
      return undefined;
    }

    let frameId = 0;
    let lastUpdate = 0;

    const updateMeters = (time: number) => {
      if (document.visibilityState === 'visible' && time - lastUpdate >= 33) {
        lastUpdate = time;
        const [input, output] = controller.readMeters();
        setMeters(input, output);
      }
      frameId = window.requestAnimationFrame(updateMeters);
    };

    frameId = window.requestAnimationFrame(updateMeters);
    return () => window.cancelAnimationFrame(frameId);
  }, [controller, isAudioReady, setMeters]);
}
