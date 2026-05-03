import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { Pedal, PedalParamValue } from './audio/types';
import AudioFilePlayerPanel from './components/audio/AudioFilePlayerPanel';
import ConnectGuitarPanel from './components/audio/ConnectGuitarPanel';
import CentralScreen from './components/hardware/CentralScreen';
import ControlKnobPanel from './components/hardware/ControlKnobPanel';
import EffectChainDisplay from './components/hardware/EffectChainDisplay';
import ExpressionPedal from './components/hardware/ExpressionPedal';
import FootSwitchPanel from './components/hardware/FootSwitchPanel';
import HardwareFrame from './components/hardware/HardwareFrame';
import LeftModePanel from './components/hardware/LeftModePanel';
import MasterStatusBar from './components/hardware/MasterStatusBar';
import RightUtilityPanel from './components/hardware/RightUtilityPanel';
import PedalDetailPanel from './components/pedalboard/PedalDetailPanel';
import PresetPanel from './components/preset/PresetPanel';
import { useAudioStore } from './store/audioStore';
import { usePedalStore } from './store/pedalStore';
import { PedalboardPreset, usePresetStore } from './store/presetStore';
import { useTempoStore } from './store/tempoStore';

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
  const currentPresetName = usePresetStore((state) => state.currentPresetName);
  const tempoBpm = useTempoStore((state) => state.bpm);
  const tapCount = useTempoStore((state) => state.tapCount);
  const pedals = usePedalStore((state) => state.pedals);
  const selectedPedalId = usePedalStore((state) => state.selectedPedalId);
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
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const loadPedalsFromStorage = usePedalStore((state) => state.loadPedalsFromStorage);
  const selectedPedal = useMemo(
    () => pedals.find((pedal) => pedal.id === selectedPedalId) ?? pedals[0] ?? null,
    [pedals, selectedPedalId],
  );
  const selectedInputName = useMemo(() => {
    const selectedDevice = inputDevices.find((device) => device.deviceId === selectedDeviceId);
    return selectedDevice?.label || (selectedDeviceId ? 'Selected input' : 'Default input');
  }, [inputDevices, selectedDeviceId]);

  useEffect(() => {
    loadPedalsFromStorage();
  }, [loadPedalsFromStorage]);

  useEffect(() => {
    if (!selectedPedalId && pedals[0]) {
      setSelectedPedal(pedals[0].id);
    }
  }, [pedals, selectedPedalId, setSelectedPedal]);

  useEffect(() => {
    audioEngineRef.current.setErrorHandler(setErrorMessage);
    return () => audioEngineRef.current.setErrorHandler(null);
  }, [setErrorMessage]);

  useEffect(() => {
    return useTempoStore.subscribe((state) => {
      const syncedDelayPedals = usePedalStore
        .getState()
        .pedals.filter(
          (pedal) => (pedal.type === 'delay' || pedal.type === 'modulation') && pedal.params.sync === true,
        );

      syncedDelayPedals.forEach((pedal) => {
        usePedalStore.getState().updatePedalParam(pedal.id, 'bpm', state.bpm);
        audioEngineRef.current.setPedalParam(pedal.id, 'bpm', state.bpm);
      });
    });
  }, []);

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

  const handleTunerQuick = useCallback(() => {
    usePedalStore.getState().setSelectedPedal('tuner');
  }, []);

  const handleTapTempo = useCallback(() => {
    useTempoStore.getState().tapTempo();
  }, []);

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

  const handleLoadPreset = useCallback(
    (preset: PedalboardPreset) => {
      usePedalStore.getState().setPedals(preset.pedals);
      useTempoStore.getState().setBpm(preset.tempoBpm);
      setMasterVolume(preset.masterVolume);
      audioEngineRef.current.setMasterVolume(preset.masterVolume);

      window.requestAnimationFrame(() => {
        const nextPedals = usePedalStore.getState().pedals;
        handleChainRebuild(nextPedals);
      });
    },
    [handleChainRebuild, setMasterVolume],
  );

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
    <main className="hardware-app">
      <HardwareFrame
        leftPanel={<LeftModePanel />}
        centralScreen={
          <CentralScreen
            patchName={currentPresetName}
            bank="A"
            patch="001"
            bpm={tempoBpm}
            isAudioReady={isAudioReady}
            inputMeter={inputMeter}
            outputMeter={outputMeter}
            selectedPedal={selectedPedal}
            effectChain={
              <EffectChainDisplay
                pedals={pedals}
                selectedPedalId={selectedPedalId}
                onSelectPedal={setSelectedPedal}
                onChainReordered={handleChainRebuild}
                onPedalToggled={handleChainRebuild}
              />
            }
          />
        }
        controlKnobPanel={
          <ControlKnobPanel selectedPedal={selectedPedal} onPedalParamChanged={handlePedalParam} />
        }
        footSwitchPanel={
          <FootSwitchPanel pedals={pedals} selectedPedalId={selectedPedalId} onPedalToggled={handleChainRebuild} />
        }
        rightUtilityPanel={
          <RightUtilityPanel
            bpm={tempoBpm}
            tapCount={tapCount}
            selectedPedalName={selectedPedal?.name ?? 'NONE'}
            onTapTempo={handleTapTempo}
            onTuner={handleTunerQuick}
          />
        }
        expressionPedal={
          <ExpressionPedal
            value={Math.round(masterVolume * 100)}
            targetLabel="MASTER"
            onChange={(value) => handleMasterVolumeChange(value / 100)}
          />
        }
        masterStatusBar={
          <MasterStatusBar
            isAudioReady={isAudioReady}
            isConnecting={isConnecting}
            inputDeviceName={selectedInputName}
            sampleRate={sampleRate}
            latencyHint={latencyHint}
            masterVolume={masterVolume}
            errorMessage={errorMessage}
            onPanic={handlePanic}
          />
        }
      />

      <div className="hardware-support-panels">
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
        <AudioFilePlayerPanel />
        <PedalDetailPanel
          onPedalToggled={handleChainRebuild}
          onPedalBypassChanged={handlePedalBypass}
          onPedalParamChanged={handlePedalParam}
        />
        <PresetPanel onLoadPreset={handleLoadPreset} />
      </div>
    </main>
  );
}

export default App;
