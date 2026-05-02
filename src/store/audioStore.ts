import { create } from 'zustand';
import { MeterReading, emptyMeterReading } from '../audio/nodes/MeterNode';

export type AudioStoreState = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputDevices: MediaDeviceInfo[];
  sampleRate: number;
  latencyHint: string;
  errorMessage: string;
  masterVolume: number;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  setIsConnecting: (isConnecting: boolean) => void;
  setAudioReady: (isAudioReady: boolean) => void;
  setSelectedDeviceId: (selectedDeviceId: string) => void;
  setInputDevices: (inputDevices: MediaDeviceInfo[]) => void;
  setSampleRate: (sampleRate: number) => void;
  setLatencyHint: (latencyHint: string) => void;
  setErrorMessage: (errorMessage: string) => void;
  setMasterVolume: (masterVolume: number) => void;
  setMeters: (inputMeter: MeterReading, outputMeter: MeterReading) => void;
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
  inputMeter: emptyMeterReading,
  outputMeter: emptyMeterReading,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setAudioReady: (isAudioReady) => set({ isAudioReady }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setInputDevices: (inputDevices) => set({ inputDevices }),
  setSampleRate: (sampleRate) => set({ sampleRate }),
  setLatencyHint: (latencyHint) => set({ latencyHint }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setMeters: (inputMeter, outputMeter) => set({ inputMeter, outputMeter }),
  resetAudioState: () =>
    set({
      isAudioReady: false,
      isConnecting: false,
      sampleRate: 0,
      errorMessage: '',
      inputMeter: emptyMeterReading,
      outputMeter: emptyMeterReading,
    }),
}));
