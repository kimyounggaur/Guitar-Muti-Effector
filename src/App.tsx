import { useCallback, useRef } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import ConnectGuitarPanel from './components/audio/ConnectGuitarPanel';
import MasterSection from './components/audio/MasterSection';
import AppShell from './components/layout/AppShell';
import FooterStatusBar from './components/layout/FooterStatusBar';
import HeaderBar from './components/layout/HeaderBar';
import PedalBoard from './components/pedalboard/PedalBoard';
import { useAudioStore } from './store/audioStore';

function App() {
  const audioEngineRef = useRef(new AudioEngine());
  const isAudioReady = useAudioStore((state) => state.isAudioReady);
  const isConnecting = useAudioStore((state) => state.isConnecting);
  const selectedDeviceId = useAudioStore((state) => state.selectedDeviceId);
  const inputDevices = useAudioStore((state) => state.inputDevices);
  const sampleRate = useAudioStore((state) => state.sampleRate);
  const latencyHint = useAudioStore((state) => state.latencyHint);
  const errorMessage = useAudioStore((state) => state.errorMessage);
  const masterVolume = useAudioStore((state) => state.masterVolume);
  const setIsConnecting = useAudioStore((state) => state.setIsConnecting);
  const setAudioReady = useAudioStore((state) => state.setAudioReady);
  const setSelectedDeviceId = useAudioStore((state) => state.setSelectedDeviceId);
  const setInputDevices = useAudioStore((state) => state.setInputDevices);
  const setSampleRate = useAudioStore((state) => state.setSampleRate);
  const setLatencyHint = useAudioStore((state) => state.setLatencyHint);
  const setErrorMessage = useAudioStore((state) => state.setErrorMessage);
  const setMasterVolume = useAudioStore((state) => state.setMasterVolume);
  const resetAudioState = useAudioStore((state) => state.resetAudioState);

  const refreshInputDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setInputDevices(devices.filter((device) => device.kind === 'audioinput'));
  }, [setInputDevices]);

  const handleConnect = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('This browser does not support audio input permissions.');
      return;
    }

    setIsConnecting(true);
    setErrorMessage('');

    try {
      const state = await audioEngineRef.current.connect(selectedDeviceId, masterVolume);
      setSampleRate(state.sampleRate);
      setLatencyHint(state.latencyHint);
      setAudioReady(true);
      await refreshInputDevices();
    } catch (error) {
      setAudioReady(false);
      setErrorMessage(error instanceof Error ? error.message : 'Could not connect guitar input.');
    } finally {
      setIsConnecting(false);
    }
  }, [
    masterVolume,
    refreshInputDevices,
    selectedDeviceId,
    setAudioReady,
    setErrorMessage,
    setIsConnecting,
    setLatencyHint,
    setSampleRate,
  ]);

  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      if (!useAudioStore.getState().isAudioReady) {
        return;
      }

      setIsConnecting(true);
      setErrorMessage('');

      try {
        const currentVolume = useAudioStore.getState().masterVolume;
        const state = await audioEngineRef.current.switchDevice(deviceId, currentVolume);
        setSampleRate(state.sampleRate);
        setLatencyHint(state.latencyHint);
        await refreshInputDevices();
      } catch (error) {
        setAudioReady(false);
        setErrorMessage(error instanceof Error ? error.message : 'Could not switch input device.');
      } finally {
        setIsConnecting(false);
      }
    },
    [
      refreshInputDevices,
      setAudioReady,
      setErrorMessage,
      setIsConnecting,
      setLatencyHint,
      setSampleRate,
      setSelectedDeviceId,
    ],
  );

  const handleMasterVolumeChange = useCallback(
    (volume: number) => {
      setMasterVolume(volume);
      audioEngineRef.current.setMasterVolume(volume);
    },
    [setMasterVolume],
  );

  const handlePanic = useCallback(() => {
    setMasterVolume(0);
    audioEngineRef.current.setMasterVolume(0);
  }, [setMasterVolume]);

  const handleStop = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage('');

    try {
      await audioEngineRef.current.stop();
      resetAudioState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not stop audio.');
    } finally {
      setIsConnecting(false);
    }
  }, [resetAudioState, setErrorMessage, setIsConnecting]);

  return (
    <AppShell
      header={
        <HeaderBar
          appName="Pedalboard Lab"
          connectionStatus={isAudioReady ? 'Connected' : isConnecting ? 'Connecting' : 'Not connected'}
          presetName="Init Patch"
        />
      }
      footer={<FooterStatusBar sampleRate={sampleRate} latencyHint={latencyHint} />}
    >
      <ConnectGuitarPanel
        isAudioReady={isAudioReady}
        isConnecting={isConnecting}
        selectedDeviceId={selectedDeviceId}
        inputDevices={inputDevices}
        errorMessage={errorMessage}
        onConnect={handleConnect}
        onStop={handleStop}
        onDeviceChange={handleDeviceChange}
      />
      <PedalBoard />
      <MasterSection
        masterVolume={masterVolume}
        isAudioReady={isAudioReady}
        onMasterVolumeChange={handleMasterVolumeChange}
        onPanic={handlePanic}
      />
    </AppShell>
  );
}

export default App;
