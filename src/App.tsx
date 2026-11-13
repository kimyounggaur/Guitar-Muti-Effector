import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { Pedal, PedalParamValue } from './audio/types';
import AudioFilePlayerPanel from './components/audio/AudioFilePlayerPanel';
import ConnectGuitarPanel from './components/audio/ConnectGuitarPanel';
import CentralScreen from './components/hardware/CentralScreen';
import ControlKnobPanel from './components/hardware/ControlKnobPanel';
import EffectChainDisplay from './components/hardware/EffectChainDisplay';
import ExpressionPedal from './components/hardware/ExpressionPedal';
import FootSwitchPanel, {
  STOMP_PRESET_CATEGORIES,
  type StompPresetCategory,
  type StompSwitchMode,
} from './components/hardware/FootSwitchPanel';
import HardwareFrame from './components/hardware/HardwareFrame';
import LeftModePanel from './components/hardware/LeftModePanel';
import LcdPresetGrid from './components/hardware/LcdPresetGrid';
import MasterStatusBar from './components/hardware/MasterStatusBar';
import RightUtilityPanel from './components/hardware/RightUtilityPanel';
import PedalDetailPanel from './components/pedalboard/PedalDetailPanel';
import PresetPanel from './components/preset/PresetPanel';
import { useAudioStore } from './store/audioStore';
import { usePedalStore } from './store/pedalStore';
import { PedalboardPreset, usePresetStore } from './store/presetStore';
import { useTempoStore } from './store/tempoStore';
import { readLocal, writeLocal } from './store/safeStorage';

const SESSION_KEY = 'guitar-multi-effector-session-v2';

function App() {
  const audioEngineRef = useRef(new AudioEngine());
  const audioOperationRef = useRef(0);
  const [activePresetCategory, setActivePresetCategory] = useState<StompPresetCategory | null>(null);
  const [stompSwitchMode, setStompSwitchMode] = useState<StompSwitchMode>('presets');
  const isAudioReady = useAudioStore((state) => state.isAudioReady);
  const isConnecting = useAudioStore((state) => state.isConnecting);
  const selectedDeviceId = useAudioStore((state) => state.selectedDeviceId);
  const inputDevices = useAudioStore((state) => state.inputDevices);
  const sampleRate = useAudioStore((state) => state.sampleRate);
  const latencyHint = useAudioStore((state) => state.latencyHint);
  const errorMessage = useAudioStore((state) => state.errorMessage);
  const masterVolume = useAudioStore((state) => state.masterVolume);
  const presets = usePresetStore((state) => state.presets);
  const activePresetId = usePresetStore((state) => state.activePresetId);
  const currentPresetName = usePresetStore((state) => state.currentPresetName);
  const hydratePresets = usePresetStore((state) => state.hydratePresets);
  const loadPreset = usePresetStore((state) => state.loadPreset);
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
  const selectedPedal = useMemo(
    () => pedals.find((pedal) => pedal.id === selectedPedalId) ?? pedals[0] ?? null,
    [pedals, selectedPedalId],
  );
  const selectedInputName = useMemo(() => {
    const selectedDevice = inputDevices.find((device) => device.deviceId === selectedDeviceId);
    return selectedDevice?.label || (selectedDeviceId ? '선택한 입력' : '기본 입력');
  }, [inputDevices, selectedDeviceId]);
  const patchAddress = useMemo(() => {
    const factoryIndex = presets.filter((preset) => preset.origin === 'factory').findIndex((preset) => preset.id === activePresetId);
    return factoryIndex >= 0
      ? { bank: 'A', patch: String(factoryIndex + 1).padStart(3, '0') }
      : { bank: activePresetId ? 'USER' : 'EDIT', patch: '—' };
  }, [activePresetId, presets]);
  const presetCategoryCounts = useMemo(
    () =>
      STOMP_PRESET_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
        counts[category] = presets.filter((preset) => isPresetInStompCategory(preset, category)).length;
        return counts;
      }, {}),
    [presets],
  );
  const lcdCategoryPresets = useMemo(
    () =>
      activePresetCategory
        ? presets.filter((preset) => isPresetInStompCategory(preset, activePresetCategory))
        : [],
    [activePresetCategory, presets],
  );
  const footSwitchEffectPedals = useMemo(
    () => pedals.filter((pedal) => pedal.type !== 'tuner').slice(0, STOMP_PRESET_CATEGORIES.length),
    [pedals],
  );

  useEffect(() => {
    const onStorageError = () => setErrorMessage('브라우저 저장 공간을 사용할 수 없습니다. 현재 설정은 새로고침하면 사라질 수 있습니다.');
    window.addEventListener('pedalboard-storage-error', onStorageError);
    hydratePresets();
    let restored = false;
    try {
      const session = JSON.parse(readLocal(SESSION_KEY) || 'null');
      if (session && Array.isArray(session.pedals)) {
        usePedalStore.getState().setPedals(session.pedals);
        if (typeof session.masterVolume === 'number' && Number.isFinite(session.masterVolume)) {
          useAudioStore.getState().setMasterVolume(Math.min(1, Math.max(0, session.masterVolume)));
        }
        if (typeof session.tempoBpm === 'number' && Number.isFinite(session.tempoBpm)) useTempoStore.getState().setBpm(session.tempoBpm);
        const existing = usePresetStore.getState().presets.find((p) => p.id === session.activePresetId);
        useAudioStore.getState().setPresetTrimDb(typeof session.outputTrimDb === 'number' ? session.outputTrimDb : existing?.outputTrimDb ?? 0);
        usePresetStore.getState().restoreSelection(existing?.id ?? null, existing?.name ?? '사용자 설정');
        restored = true;
      }
    } catch { /* Invalid saved session falls back to the factory patch. */ }
    if (!restored) {
      // Preserve boards from the previous version without falsely labeling them as a factory patch.
      try {
        const legacyPedals = JSON.parse(readLocal('guitar-multi-effector-pedals-v1') || 'null');
        if (Array.isArray(legacyPedals)) {
          usePedalStore.getState().setPedals(legacyPedals);
          usePresetStore.getState().restoreSelection(null, '이전 작업 설정');
          restored = true;
        }
      } catch { /* Ignore invalid legacy data. */ }
    }
    if (!restored) {
      const first = usePresetStore.getState().presets[0];
      if (first) {
        usePedalStore.getState().setPedals(first.pedals);
        useAudioStore.getState().setPresetTrimDb(first.outputTrimDb);
        useTempoStore.getState().setBpm(first.tempoBpm);
      }
    }
    let timer = 0;
    const save = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const audio = useAudioStore.getState();
        const preset = usePresetStore.getState();
        writeLocal(SESSION_KEY, JSON.stringify({ pedals: usePedalStore.getState().pedals, masterVolume: audio.masterVolume, outputTrimDb: audio.presetTrimDb, tempoBpm: useTempoStore.getState().bpm, activePresetId: preset.activePresetId }));
      }, 300);
    };
    writeLocal(SESSION_KEY, JSON.stringify({ pedals: usePedalStore.getState().pedals, masterVolume: useAudioStore.getState().masterVolume, outputTrimDb: useAudioStore.getState().presetTrimDb, tempoBpm: useTempoStore.getState().bpm, activePresetId: usePresetStore.getState().activePresetId }));
    const unsubPedals = usePedalStore.subscribe((state, previous) => { if (state.pedals !== previous.pedals) save(); });
    const unsubAudio = useAudioStore.subscribe((state, previous) => { if (state.masterVolume !== previous.masterVolume || state.presetTrimDb !== previous.presetTrimDb) save(); });
    const unsubTempo = useTempoStore.subscribe((state, previous) => { if (state.bpm !== previous.bpm) save(); });
    const unsubPreset = usePresetStore.subscribe((state, previous) => { if (state.activePresetId !== previous.activePresetId) save(); });
    return () => { window.clearTimeout(timer); unsubPedals(); unsubAudio(); unsubTempo(); unsubPreset(); window.removeEventListener('pedalboard-storage-error', onStorageError); };
  }, [hydratePresets, setErrorMessage]);

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
    const engine = audioEngineRef.current;
    engine.setInputEndedHandler(() => {
      ++audioOperationRef.current;
      resetAudioState();
      setMasterVolume(0);
      setErrorMessage('입력 장치 연결이 끊겨 오디오를 정지했습니다. 장치를 확인하고 다시 연결해 주세요.');
    });
    return () => engine.setInputEndedHandler(null);
  }, [resetAudioState, setErrorMessage, setMasterVolume]);

  useEffect(() => {
    const syncTempo = (bpm: number) => {
      const syncedPedals = usePedalStore.getState().pedals.filter(
        (pedal) => pedal.type === 'rhythm' || pedal.type === 'looper' || ((pedal.type === 'delay' || pedal.type === 'modulation') && pedal.params.sync === true),
      );
      syncedPedals.forEach((pedal) => {
        if (pedal.params.bpm !== bpm) usePedalStore.getState().updatePedalParam(pedal.id, 'bpm', bpm);
        audioEngineRef.current.setPedalParam(pedal.id, 'bpm', bpm);
      });
    };
    syncTempo(useTempoStore.getState().bpm);
    return useTempoStore.subscribe((state, previous) => { if (state.bpm !== previous.bpm) syncTempo(state.bpm); });
  }, []);

  useEffect(() => {
    audioEngineRef.current.setPresetTrimDb(useAudioStore.getState().presetTrimDb);
    audioEngineRef.current.setInputChannel(useAudioStore.getState().inputChannel);
    return useAudioStore.subscribe((state, previous) => {
      if (state.presetTrimDb !== previous.presetTrimDb) audioEngineRef.current.setPresetTrimDb(state.presetTrimDb);
      if (state.inputChannel !== previous.inputChannel) audioEngineRef.current.setInputChannel(state.inputChannel);
    });
  }, []);

  useEffect(() => {
    if (!isAudioReady) {
      return undefined;
    }

    let frameId = 0;
    let lastUpdate = 0;

    const updateMeters = (time: number) => {
      if (document.visibilityState === 'visible' && time - lastUpdate >= 33) {
        lastUpdate = time;
        setMeters(audioEngineRef.current.readInputMeter(), audioEngineRef.current.readOutputMeter());
      }
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
      setErrorMessage('이 브라우저는 오디오 입력을 지원하지 않습니다. HTTPS 주소에서 최신 Chrome 또는 Safari로 다시 열어 주세요.');
      return;
    }

    const operation = ++audioOperationRef.current;
    setIsConnecting(true);
    setErrorMessage('');

    try {
      const state = await audioEngineRef.current.connect(selectedDeviceId, 0);
      if (operation !== audioOperationRef.current) return;
      audioEngineRef.current.setMasterVolume(useAudioStore.getState().masterVolume);
      setSampleRate(state.sampleRate);
      setLatencyHint(state.latencyHint);
      setAudioReady(true);
      audioEngineRef.current.rebuildChain(usePedalStore.getState().pedals);
      await refreshInputDevices();
    } catch (error) {
      if (operation !== audioOperationRef.current) return;
      setAudioReady(false);
      setErrorMessage(error instanceof Error ? error.message : 'Could not connect guitar input.');
    } finally {
      if (operation === audioOperationRef.current) setIsConnecting(false);
    }
  }, [
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

      const operation = ++audioOperationRef.current;
      setIsConnecting(true);
      setErrorMessage('');

      try {
        const state = await audioEngineRef.current.switchDevice(deviceId, 0);
        if (operation !== audioOperationRef.current) return;
        audioEngineRef.current.setMasterVolume(useAudioStore.getState().masterVolume);
        setSampleRate(state.sampleRate);
        setLatencyHint(state.latencyHint);
        audioEngineRef.current.rebuildChain(usePedalStore.getState().pedals);
        await refreshInputDevices();
      } catch (error) {
        if (operation !== audioOperationRef.current) return;
        setAudioReady(false);
        setErrorMessage(error instanceof Error ? error.message : 'Could not switch input device.');
      } finally {
        if (operation === audioOperationRef.current) setIsConnecting(false);
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

  const handlePanic = useCallback(async () => {
    const operation = ++audioOperationRef.current;
    setIsConnecting(true);
    setMasterVolume(0);
    audioEngineRef.current.setMasterVolume(0);
    audioEngineRef.current.panicDisconnect();
    resetAudioState();
    setIsConnecting(true);
    try { await audioEngineRef.current.stop(); }
    catch { setErrorMessage('오디오를 정지하는 중 오류가 발생했습니다. 입력 장치를 확인해 주세요.'); }
    finally { if (operation === audioOperationRef.current) setIsConnecting(false); }
  }, [resetAudioState, setErrorMessage, setIsConnecting, setMasterVolume]);

  const handleTunerQuick = useCallback(() => {
    usePedalStore.getState().setSelectedPedal('tuner');
    setActivePresetCategory(null);
    window.requestAnimationFrame(() => document.querySelector('.tuner-detail-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const handleTapTempo = useCallback(() => {
    useTempoStore.getState().tapTempo();
  }, []);

  const handleStompSwitchModeChange = useCallback((mode: StompSwitchMode) => {
    setStompSwitchMode(mode);

    if (mode === 'effects') {
      setActivePresetCategory(null);
    }
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
    const pedal = usePedalStore.getState().pedals.find((item) => item.id === pedalId);
    audioEngineRef.current.setPedalBypass(pedalId, bypassed || !pedal?.enabled);
  }, []);

  const handlePedalParam = useCallback((pedalId: string, paramName: string, value: PedalParamValue) => {
    audioEngineRef.current.setPedalParam(pedalId, paramName, value);
  }, []);

  const handleFootSwitchEffectToggle = useCallback(
    (pedalId: string) => {
      const pedalStore = usePedalStore.getState();
      const pedal = pedalStore.pedals.find((item) => item.id === pedalId);

      if (!pedal) {
        return;
      }

      pedalStore.setSelectedPedal(pedalId);

      if (pedal.enabled && !pedal.bypassed) {
        pedalStore.togglePedal(pedalId);
      } else {
        if (!pedal.enabled) {
          pedalStore.togglePedal(pedalId);
        }

        if (pedal.bypassed) {
          pedalStore.setPedalBypass(pedalId, false);
        }
      }

      window.requestAnimationFrame(() => handleChainRebuild(usePedalStore.getState().pedals));
    },
    [handleChainRebuild],
  );

  const handlePrepareUploadedAudio = useCallback(
    async (audioElement: HTMLAudioElement) => {
      const operation = ++audioOperationRef.current;
      setIsConnecting(true);
      setErrorMessage('');

      try {
        const state = await audioEngineRef.current.connectUploadedAudio(
          audioElement,
          0,
          usePedalStore.getState().pedals,
        );
        if (operation !== audioOperationRef.current) throw new DOMException('오디오 연결이 취소되었습니다.', 'AbortError');
        audioEngineRef.current.setMasterVolume(useAudioStore.getState().masterVolume);
        setSampleRate(state.sampleRate);
        setLatencyHint(state.latencyHint);
        setAudioReady(true);
      } catch (error) {
        if (operation !== audioOperationRef.current) throw error;
        const message = error instanceof Error ? error.message : 'Could not route uploaded audio through effects.';
        setAudioReady(false);
        setErrorMessage(message);
        throw new Error(message);
      } finally {
        if (operation === audioOperationRef.current) setIsConnecting(false);
      }
    },
    [setAudioReady, setErrorMessage, setIsConnecting, setLatencyHint, setSampleRate],
  );

  const handleLoadPreset = useCallback(
    (preset: PedalboardPreset) => {
      useAudioStore.getState().setPresetTrimDb(preset.outputTrimDb);
      usePedalStore.getState().setPedals(preset.pedals);
      useTempoStore.getState().setBpm(preset.tempoBpm);
      usePedalStore.getState().pedals.forEach((pedal) => {
        if (pedal.type === 'rhythm' || pedal.type === 'looper' || ((pedal.type === 'delay' || pedal.type === 'modulation') && pedal.params.sync === true)) {
          usePedalStore.getState().updatePedalParam(pedal.id, 'bpm', preset.tempoBpm);
        }
      });

      window.requestAnimationFrame(() => {
        const nextPedals = usePedalStore.getState().pedals;
        handleChainRebuild(nextPedals);
      });
    },
    [handleChainRebuild],
  );

  const handleLoadPresetFromLcd = useCallback(
    (preset: PedalboardPreset) => {
      const loadedPreset = loadPreset(preset.id);
      if (loadedPreset) {
        handleLoadPreset(loadedPreset);
      }
    },
    [handleLoadPreset, loadPreset],
  );

  const handleStop = useCallback(async () => {
    const operation = ++audioOperationRef.current;
    setIsConnecting(true);
    setErrorMessage('');

    try {
      await audioEngineRef.current.stop();
      if (operation !== audioOperationRef.current) return;
      resetAudioState();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not stop audio.');
    } finally {
      if (operation === audioOperationRef.current) setIsConnecting(false);
    }
  }, [resetAudioState, setErrorMessage, setIsConnecting]);

  return (
    <main className="hardware-app">
      <div className="hardware-support-panels hardware-primary-controls">
        <ConnectGuitarPanel
          isAudioReady={isAudioReady}
          isConnecting={isConnecting}
          selectedDeviceId={selectedDeviceId}
          inputDevices={inputDevices}
          errorMessage={errorMessage}
          onConnect={handleConnect}
          onStop={handleStop}
          onDeviceChange={handleDeviceChange}
          onOutputDeviceChange={(id) => audioEngineRef.current.setOutputDevice(id)}
        />
        <button type="button" className="panic-button" onClick={handlePanic}>긴급 음소거 · PANIC</button>
      </div>
      <HardwareFrame
        leftPanel={<LeftModePanel onOpenBoard={() => setActivePresetCategory(null)} />}
        centralScreen={
          <CentralScreen
            patchName={currentPresetName}
            bank={patchAddress.bank}
            patch={patchAddress.patch}
            bpm={tempoBpm}
            isAudioReady={isAudioReady}
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
            presetBrowser={
              activePresetCategory ? (
                <LcdPresetGrid
                  category={activePresetCategory}
                  presets={lcdCategoryPresets}
                  activePresetId={activePresetId}
                  onLoadPreset={handleLoadPresetFromLcd}
                  onClose={() => setActivePresetCategory(null)}
                />
              ) : undefined
            }
          />
        }
        controlKnobPanel={
          <ControlKnobPanel selectedPedal={selectedPedal} onPedalParamChanged={handlePedalParam} />
        }
        footSwitchPanel={
          <FootSwitchPanel
            mode={stompSwitchMode}
            activeCategory={activePresetCategory}
            categoryCounts={presetCategoryCounts}
            effectPedals={footSwitchEffectPedals}
            selectedPedalId={selectedPedalId}
            onModeChanged={handleStompSwitchModeChange}
            onCategorySelected={setActivePresetCategory}
            onEffectPedalToggled={handleFootSwitchEffectToggle}
          />
        }
        rightUtilityPanel={
          <RightUtilityPanel
            bpm={tempoBpm}
            tapCount={tapCount}
            masterVolume={masterVolume}
            selectedPedalName={selectedPedal?.name ?? 'NONE'}
            onMasterVolumeChange={handleMasterVolumeChange}
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

        <PedalDetailPanel
          onPedalToggled={handleChainRebuild}
          onPedalBypassChanged={handlePedalBypass}
          onPedalParamChanged={handlePedalParam}
        />
        <AudioFilePlayerPanel isEffectChainReady={isAudioReady} onPreparePlayback={handlePrepareUploadedAudio} />
        <PresetPanel onLoadPreset={handleLoadPreset} />
      </div>
    </main>
  );
}

const isPresetInStompCategory = (preset: PedalboardPreset, category: StompPresetCategory) =>
  category === 'User Presets'
    ? preset.origin !== 'factory' || preset.category === 'User Presets'
    : preset.category === category;

export default App;
