import { create } from 'zustand';
import { MeterReading, emptyMeterReading } from '../audio/nodes/MeterNode';
import type { InputChannel } from '../audio/AudioEngine';

export type AudioStoreState = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputChannel: InputChannel;
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
  setInputChannel: (inputChannel: InputChannel) => void;
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
  inputChannel: '1',
  inputDevices: [],
  sampleRate: 0,
  latencyHint: '측정 불가',
  errorMessage: '',
  masterVolume: 0.35,
  inputMeter: emptyMeterReading,
  outputMeter: emptyMeterReading,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setAudioReady: (isAudioReady) => set({ isAudioReady }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setInputChannel: (inputChannel) => set({ inputChannel }),
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
