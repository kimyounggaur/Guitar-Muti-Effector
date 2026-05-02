import { create } from 'zustand';

export type AudioStoreState = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputDevices: MediaDeviceInfo[];
  sampleRate: number;
  latencyHint: string;
  errorMessage: string;
  masterVolume: number;
  setIsConnecting: (isConnecting: boolean) => void;
  setAudioReady: (isAudioReady: boolean) => void;
  setSelectedDeviceId: (selectedDeviceId: string) => void;
  setInputDevices: (inputDevices: MediaDeviceInfo[]) => void;
  setSampleRate: (sampleRate: number) => void;
  setLatencyHint: (latencyHint: string) => void;
  setErrorMessage: (errorMessage: string) => void;
  setMasterVolume: (masterVolume: number) => void;
  resetAudioState: () => void;
};

export const useAudioStore = create<AudioStoreState>((set) => ({
  isAudioReady: false,
  isConnecting: false,
  selectedDeviceId: '',
  inputDevices: [],
  sampleRate: 0,
  latencyHint: 'interactive',
  errorMessage: '',
  masterVolume: 0.35,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setAudioReady: (isAudioReady) => set({ isAudioReady }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setInputDevices: (inputDevices) => set({ inputDevices }),
  setSampleRate: (sampleRate) => set({ sampleRate }),
  setLatencyHint: (latencyHint) => set({ latencyHint }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  resetAudioState: () =>
    set({
      isAudioReady: false,
      isConnecting: false,
      sampleRate: 0,
      errorMessage: '',
    }),
}));
