import { useCallback, useEffect, useRef, useState } from 'react';
import { DragCancelEvent, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { AudioEngine } from './audio/AudioEngine';
import { PedalPatch } from './audio/types';
import ConnectGuitarPanel from './components/audio/ConnectGuitarPanel';
import MasterSection from './components/audio/MasterSection';
import TunerPanel from './components/effects/TunerPanel';
import AppShell from './components/layout/AppShell';
import FooterStatusBar from './components/layout/FooterStatusBar';
import HeaderBar from './components/layout/HeaderBar';
import PedalBoard from './components/pedalboard/PedalBoard';
import PresetPanel from './components/preset/PresetPanel';
import { useAudioStore } from './store/audioStore';
import { usePedalStore } from './store/pedalStore';
import { usePresetStore } from './store/presetStore';

function App() {
  const engineRef = useRef(new AudioEngine());
  const pedals = usePedalStore((state) => state.pedals);
  const isDragging = usePedalStore((state) => state.isDragging);
  const setDragging = usePedalStore((state) => state.setDragging);
  const updatePedal = usePedalStore((state) => state.updatePedal);
  const setPedalParam = usePedalStore((state) => state.setPedalParam);
  const reorderPedals = usePedalStore((state) => state.reorderPedals);
  const setPedals = usePedalStore((state) => state.setPedals);
  const resetPedals = usePedalStore((state) => state.resetPedals);

  const selectedDeviceId = useAudioStore((state) => state.selectedDeviceId);
  const masterVolume = useAudioStore((state) => state.masterVolume);
  const status = useAudioStore((state) => state.status);
  const statusText = useAudioStore((state) => state.statusText);
  const inputMeter = useAudioStore((state) => state.inputMeter);
  const outputMeter = useAudioStore((state) => state.outputMeter);
  const tuner = useAudioStore((state) => state.tuner);
  const setSelectedDeviceId = useAudioStore((state) => state.setSelectedDeviceId);
  const setMasterVolume = useAudioStore((state) => state.setMasterVolume);
  const setStatus = useAudioStore((state) => state.setStatus);
  const setMeters = useAudioStore((state) => state.setMeters);
  const setTuner = useAudioStore((state) => state.setTuner);

  const presets = usePresetStore((state) => state.presets);
  const selectedPresetId = usePresetStore((state) => state.selectedPresetId);
  const savePreset = usePresetStore((state) => state.savePreset);
  const getPreset = usePresetStore((state) => state.getPreset);
  const selectPreset = usePresetStore((state) => state.selectPreset);
  const deletePreset = usePresetStore((state) => state.deletePreset);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    setDevices(mediaDevices.filter((device) => device.kind === 'audioinput'));
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  useEffect(() => {
    return () => engineRef.current.dispose();
  }, []);

  useEffect(() => {
    if (status !== 'connected') {
      return undefined;
    }

    let raf = 0;
    let lastMeterAt = 0;
    let lastTunerAt = 0;

    const tick = (time: number) => {
      const engine = engineRef.current;

      if (time - lastMeterAt > 32) {
        setMeters(engine.readInputMeter(), engine.readOutputMeter());
        lastMeterAt = time;
      }

      if (time - lastTunerAt > 130) {
        setTuner(engine.readTuner());
        lastTunerAt = time;
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [setMeters, setTuner, status]);

  const syncPedalToEngine = useCallback((pedalId: string) => {
    const pedal = usePedalStore.getState().pedals.find((item) => item.id === pedalId);
    if (pedal) {
      engineRef.current.updatePedal(pedal);
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error', 'This browser does not expose getUserMedia.');
      return;
    }

    setStatus('connecting', 'Requesting guitar input permission...');

    try {
      const audioState = useAudioStore.getState();
      const pedalState = usePedalStore.getState();
      await engineRef.current.connect(audioState.selectedDeviceId || undefined, pedalState.pedals, audioState.masterVolume);
      setStatus('connected', 'Live input connected.');
      await refreshDevices();
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : 'Could not connect audio input.');
    }
  }, [refreshDevices, setStatus]);

  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      if (useAudioStore.getState().status !== 'connected') {
        return;
      }

      setStatus('connected', 'Switching input device...');
      try {
        await engineRef.current.switchInput(deviceId || undefined, usePedalStore.getState().pedals);
        setStatus('connected', 'Live input connected.');
        await refreshDevices();
      } catch (error) {
        setStatus('error', error instanceof Error ? error.message : 'Could not switch audio input.');
      }
    },
    [refreshDevices, setSelectedDeviceId, setStatus],
  );

  const handleMasterVolume = useCallback(
    (volume: number) => {
      setMasterVolume(volume);
      engineRef.current.setMasterVolume(volume);
    },
    [setMasterVolume],
  );

  const handlePedalPatch = useCallback(
    (pedalId: string, patch: PedalPatch) => {
      updatePedal(pedalId, patch);
      syncPedalToEngine(pedalId);
    },
    [syncPedalToEngine, updatePedal],
  );

  const handlePedalParam = useCallback(
    (pedalId: string, key: string, value: number) => {
      setPedalParam(pedalId, key, value);
      syncPedalToEngine(pedalId);
    },
    [setPedalParam, syncPedalToEngine],
  );

  const handleDragStart = useCallback(
    (_event: DragStartEvent) => {
      setDragging(true);
    },
    [setDragging],
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      setDragging(false);
    },
    [setDragging],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(false);
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      reorderPedals(String(active.id), String(over.id));
      window.requestAnimationFrame(() => {
        engineRef.current.rebuildChain(usePedalStore.getState().pedals);
      });
    },
    [reorderPedals, setDragging],
  );

  const handleSavePreset = useCallback(
    (name: string) => {
      const audioState = useAudioStore.getState();
      savePreset(name, usePedalStore.getState().pedals, audioState.masterVolume);
    },
    [savePreset],
  );

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      if (!presetId) {
        return;
      }

      const preset = getPreset(presetId);
      if (!preset) {
        return;
      }

      setPedals(preset.pedals);
      setMasterVolume(preset.masterVolume);
      selectPreset(presetId);
      engineRef.current.setMasterVolume(preset.masterVolume);
      window.requestAnimationFrame(() => {
        engineRef.current.rebuildChain(usePedalStore.getState().pedals);
      });
    },
    [getPreset, selectPreset, setMasterVolume, setPedals],
  );

  const handleFactoryReset = useCallback(() => {
    resetPedals();
    setMasterVolume(0.82);
    selectPreset(null);
    engineRef.current.setMasterVolume(0.82);
    window.requestAnimationFrame(() => {
      engineRef.current.rebuildChain(usePedalStore.getState().pedals);
    });
  }, [resetPedals, selectPreset, setMasterVolume]);

  const handlePanic = useCallback(() => {
    engineRef.current.panic(usePedalStore.getState().pedals);
    setStatus(useAudioStore.getState().status, 'Panic reset sent to the audio chain.');
  }, [setStatus]);

  return (
    <AppShell
      header={<HeaderBar status={status} statusText={statusText} />}
      footer={<FooterStatusBar connected={status === 'connected'} sampleRate={engineRef.current.sampleRate} />}
    >
      <section className="top-grid" aria-label="Audio controls">
        <ConnectGuitarPanel
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          status={status}
          onConnect={handleConnect}
          onDeviceChange={handleDeviceChange}
          onPanic={handlePanic}
        />
        <MasterSection
          inputMeter={inputMeter}
          outputMeter={outputMeter}
          masterVolume={masterVolume}
          onMasterVolumeChange={handleMasterVolume}
        />
        <TunerPanel tuner={tuner} connected={status === 'connected'} />
      </section>

      <PedalBoard
        pedals={pedals}
        isDragging={isDragging}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onPatch={handlePedalPatch}
        onParam={handlePedalParam}
      />

      <PresetPanel
        presets={presets}
        selectedPresetId={selectedPresetId}
        onSave={handleSavePreset}
        onLoad={handleLoadPreset}
        onDelete={deletePreset}
        onFactoryReset={handleFactoryReset}
      />
    </AppShell>
  );
}

export default App;
