import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { createAudioController, type AudioController } from './audioController';

const AudioControllerContext = createContext<AudioController | null>(null);

/** Creates the engine and its controller once, and attaches engine events while mounted. */
export function AudioControllerProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => createAudioController(new AudioEngine()));
  useEffect(() => controller.attach(), [controller]);
  return <AudioControllerContext.Provider value={controller}>{children}</AudioControllerContext.Provider>;
}

export function useAudioController(): AudioController {
  const controller = useContext(AudioControllerContext);
  if (!controller) throw new Error('useAudioController must be used inside AudioControllerProvider');
  return controller;
}
