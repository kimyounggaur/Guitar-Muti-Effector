import { create } from 'zustand';
import { ConnectionStatus, MeterReading, TunerReading } from '../audio/types';

const emptyMeter: MeterReading = { rms: 0, peak: 0, db: -120 };
const emptyTuner: TunerReading = { note: '--', frequency: null, cents: 0, confidence: 0 };

type AudioStore = {
  selectedDeviceId: string;
  masterVolume: number;
  status: ConnectionStatus;
  statusText: string;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  tuner: TunerReading;
  setSelectedDeviceId: (deviceId: string) => void;
  setMasterVolume: (volume: number) => void;
  setStatus: (status: ConnectionStatus, statusText: string) => void;
  setMeters: (inputMeter: MeterReading, outputMeter: MeterReading) => void;
  setTuner: (tuner: TunerReading) => void;
};

export const useAudioStore = create<AudioStore>((set) => ({
  selectedDeviceId: '',
  masterVolume: 0.82,
  status: 'idle',
  statusText: 'Audio engine is idle.',
  inputMeter: emptyMeter,
  outputMeter: emptyMeter,
  tuner: emptyTuner,
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setStatus: (status, statusText) => set({ status, statusText }),
  setMeters: (inputMeter, outputMeter) => set({ inputMeter, outputMeter }),
  setTuner: (tuner) => set({ tuner }),
}));
