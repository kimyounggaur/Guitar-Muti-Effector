import { useCallback, useEffect, useRef } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { Pedal, PedalParamValue } from './audio/types';
import ConnectGuitarPanel from './components/audio/ConnectGuitarPanel';
import MasterSection from './components/audio/MasterSection';
import AppShell from './components/layout/AppShell';
import FooterStatusBar from './components/layout/FooterStatusBar';
import HeaderBar from './components/layout/HeaderBar';
import PedalBoard from './components/pedalboard/PedalBoard';
import { useAudioStore } from './store/audioStore';
import { usePedalStore } from './store/pedalStore';

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
  const inputMeter = useAudioStore((state) => state.inputMeter);
  const outputMeter = useAudioStore((state) => state.outputMeter);
  const setIsConnecting = useAudioStore((state) => state.setIsConnecting);
  const setAudioReady = useAudioStore((state) => state.setAudioReady);
  const setSelectedDeviceId = useAudioStore((state) => state.setSelectedDeviceId);
  const setInputDevices = useAudioStore((state) => state.setInputDevices);
  const setSampleRate = useAudioStore((state) => state.setSampleRate);
  const setLatencyHint = useAudioStore((state) => state.setLatencyHint);
  const setErrorMessage = useAudioStore((state) => state.setErrorMessage);
  const setMasterVolume = useAudioStore((state) => state.setMasterVolume);
  const setMeters = useAudioStore((state) => state.setMeters);
  const resetAudioState = useAudioStore((state) => state.resetAudioState);

  useEffect(() => {
    audioEngineRef.current.setErrorHandler(setErrorMessage);
    return () => audioEngineRef.current.setErrorHandler(null);
  }, [setErrorMessage]);

  useEffect(() => {
    if (!isAudioReady) {
      return undefined;
    }

    let frameId = 0;

    const updateMeters = () => {
      setMeters(audioEngineRef.current.readInputMeter(), audioEngineRef.current.readOutputMeter());
      frameId = window.requestAnimationFrame(updateMeters);
    };

    frameId = window.requestAnimationFrame(updateMeters);
    return () => window.cancelAnimationFrame(frameId);
  }, [isAudioReady, setMeters]);

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
      audioEngineRef.current.rebuildChain(usePedalStore.getState().pedals);
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
        audioEngineRef.current.rebuildChain(usePedalStore.getState().pedals);
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
    audioEngineRef.current.panicDisconnect();
  }, [setMasterVolume]);

  const handleChainRebuild = useCallback(
    (pedals: Pedal[]) => {
      try {
        audioEngineRef.current.rebuildChain(pedals);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Could not rebuild audio chain.');
      }
    },
    [setErrorMessage],
  );

  const handlePedalBypass = useCallback((pedalId: string, bypassed: boolean) => {
    audioEngineRef.current.setPedalBypass(pedalId, bypassed);
  }, []);

  const handlePedalParam = useCallback((pedalId: string, paramName: string, value: PedalParamValue) => {
    audioEngineRef.current.setPedalParam(pedalId, paramName, value);
  }, []);

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
      <PedalBoard
        onChainReordered={handleChainRebuild}
        onPedalToggled={handleChainRebuild}
        onPedalBypassChanged={handlePedalBypass}
        onPedalParamChanged={handlePedalParam}
      />
      <MasterSection
        masterVolume={masterVolume}
        isAudioReady={isAudioReady}
        inputMeter={inputMeter}
        outputMeter={outputMeter}
        onMasterVolumeChange={handleMasterVolumeChange}
        onPanic={handlePanic}
      />
    </AppShell>
  );
}

export default App;
