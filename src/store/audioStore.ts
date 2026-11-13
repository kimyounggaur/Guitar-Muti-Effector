import { create } from 'zustand';
import { MeterReading, emptyMeterReading } from '../audio/nodes/MeterNode';
import type { InputChannel } from '../audio/AudioEngine';

export type AudioStoreState = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputChannel: InputChannel;
  selectedOutputDeviceId: string;
  outputDevices: MediaDeviceInfo[];
  inputDevices: MediaDeviceInfo[];
  sampleRate: number;
  latencyHint: string;
  errorMessage: string;
  masterVolume: number;
  presetTrimDb: number;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  setIsConnecting: (isConnecting: boolean) => void;
  setAudioReady: (isAudioReady: boolean) => void;
  setSelectedDeviceId: (selectedDeviceId: string) => void;
  setInputChannel: (inputChannel: InputChannel) => void;
  setSelectedOutputDeviceId: (id: string) => void;
  setOutputDevices: (devices: MediaDeviceInfo[]) => void;
  setInputDevices: (inputDevices: MediaDeviceInfo[]) => void;
  setSampleRate: (sampleRate: number) => void;
  setLatencyHint: (latencyHint: string) => void;
  setErrorMessage: (errorMessage: string) => void;
  setMasterVolume: (masterVolume: number) => void;
  setPresetTrimDb: (db: number) => void;
  setMeters: (inputMeter: MeterReading, outputMeter: MeterReading) => void;
  resetAudioState: () => void;
};

export const useAudioStore = create<AudioStoreState>((set) => ({
  isAudioReady: false,
  isConnecting: false,
  selectedDeviceId: '',
  inputChannel: '1',
  selectedOutputDeviceId: '',
  outputDevices: [],
  inputDevices: [],
  sampleRate: 0,
  latencyHint: '측정 불가',
  errorMessage: '',
  masterVolume: 0.35,
  presetTrimDb: 0,
  inputMeter: emptyMeterReading,
  outputMeter: emptyMeterReading,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  setAudioReady: (isAudioReady) => set({ isAudioReady }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setInputChannel: (inputChannel) => set({ inputChannel }),
  setSelectedOutputDeviceId: (selectedOutputDeviceId) => set({ selectedOutputDeviceId }),
  setOutputDevices: (outputDevices) => set({ outputDevices }),
  setInputDevices: (inputDevices) => set({ inputDevices }),
  setSampleRate: (sampleRate) => set({ sampleRate }),
  setLatencyHint: (latencyHint) => set({ latencyHint }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setPresetTrimDb: (db) => set({ presetTrimDb: Number.isFinite(db) ? Math.max(-36, Math.min(0, db)) : 0 }),
  setMeters: (inputMeter, outputMeter) => set({ inputMeter, outputMeter }),
  resetAudioState: () =>
    set({
      isAudioReady: false,
      isConnecting: false,
      sampleRate: 0,
      latencyHint: '측정 불가',
      selectedOutputDeviceId: '',
      errorMessage: '',
      inputMeter: emptyMeterReading,
      outputMeter: emptyMeterReading,
    }),
}));
