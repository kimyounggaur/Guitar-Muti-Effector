import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAudioController } from './app/AudioControllerContext';
import { scrollToTarget } from './app/scrollTargets';
import { useMeterLoop } from './app/useMeterLoop';
import { useSessionPersistence } from './app/useSessionPersistence';
import { useStompView } from './app/useStompView';
import AudioFilePlayerPanel from './components/audio/AudioFilePlayerPanel';
import ConnectGuitarPanel from './components/audio/ConnectGuitarPanel';
import CentralScreen from './components/hardware/CentralScreen';
import ControlKnobPanel from './components/hardware/ControlKnobPanel';
import EffectChainDisplay from './components/hardware/EffectChainDisplay';
import ExpressionPedal from './components/hardware/ExpressionPedal';
import FootSwitchPanel, { type StompPresetCategory, type StompSwitchMode } from './components/hardware/FootSwitchPanel';
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

function App() {
  const controller = useAudioController();
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
  const expression = useAudioStore((state) => state.expression);
  const activePresetId = usePresetStore((state) => state.activePresetId);
  const currentPresetName = usePresetStore((state) => state.currentPresetName);
  const loadPreset = usePresetStore((state) => state.loadPreset);
  const tempoBpm = useTempoStore((state) => state.bpm);
  const tapCount = useTempoStore((state) => state.tapCount);
  const pedals = usePedalStore((state) => state.pedals);
  const selectedPedalId = usePedalStore((state) => state.selectedPedalId);
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const selectedPedal = useMemo(
    () => pedals.find((pedal) => pedal.id === selectedPedalId) ?? pedals[0] ?? null,
    [pedals, selectedPedalId],
  );
  const selectedInputName = useMemo(() => {
    const selectedDevice = inputDevices.find((device) => device.deviceId === selectedDeviceId);
    return selectedDevice?.label || (selectedDeviceId ? '선택한 입력' : '기본 입력');
  }, [inputDevices, selectedDeviceId]);
  const { patchAddress, presetCategoryCounts, lcdCategoryPresets, footSwitchEffectPedals } = useStompView(activePresetCategory);
  useMeterLoop(controller);
  useSessionPersistence();

  useEffect(() => {
    if (!selectedPedalId && pedals[0]) {
      setSelectedPedal(pedals[0].id);
    }
  }, [pedals, selectedPedalId, setSelectedPedal]);

  const handleTunerQuick = useCallback(() => {
    usePedalStore.getState().setSelectedPedal('tuner');
    setActivePresetCategory(null);
    window.requestAnimationFrame(() => scrollToTarget('tuner'));
  }, []);

  const handleStompSwitchModeChange = useCallback((mode: StompSwitchMode) => {
    setStompSwitchMode(mode);
    if (mode === 'effects') setActivePresetCategory(null);
  }, []);

  const handleLoadPresetFromLcd = useCallback(
    (preset: PedalboardPreset) => {
      const loadedPreset = loadPreset(preset.id);
      if (loadedPreset) controller.loadPreset(loadedPreset);
    },
    [controller, loadPreset],
  );

  return (
    <main className="hardware-app">
      <div className="hardware-support-panels hardware-primary-controls">
        <ConnectGuitarPanel
          isAudioReady={isAudioReady}
          isConnecting={isConnecting}
          selectedDeviceId={selectedDeviceId}
          inputDevices={inputDevices}
          errorMessage={errorMessage}
          onConnect={controller.connect}
          onStop={controller.stop}
          onDeviceChange={controller.switchInput}
          onOutputDeviceChange={controller.setOutputDevice}
        />
        <button type="button" className="panic-button" onClick={controller.panic}>긴급 음소거 · PANIC</button>
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
                onChainReordered={controller.rebuildChain}
                onPedalToggled={controller.rebuildChain}
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
          <ControlKnobPanel selectedPedal={selectedPedal} onPedalParamChanged={controller.setParam} />
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
            onEffectPedalToggled={controller.footSwitchToggle}
          />
        }
        rightUtilityPanel={
          <RightUtilityPanel
            bpm={tempoBpm}
            tapCount={tapCount}
            masterVolume={masterVolume}
            selectedPedalName={selectedPedal?.name ?? 'NONE'}
            onMasterVolumeChange={controller.setMasterVolume}
            onTapTempo={controller.tapTempo}
            onTuner={handleTunerQuick}
          />
        }
        expressionPedal={
          <ExpressionPedal
            value={Math.round(expression * 100)}
            targetLabel="VOLUME"
            masterPercent={Math.round(masterVolume * 100)}
            onChange={(value) => controller.setExpression(value / 100)}
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
            onPanic={controller.panic}
          />
        }
      />

      <div className="hardware-support-panels">
        <PedalDetailPanel
          onPedalToggled={controller.rebuildChain}
          onPedalBypassChanged={controller.setPedalBypass}
          onPedalParamChanged={controller.setParam}
        />
        <AudioFilePlayerPanel isEffectChainReady={isAudioReady} onPreparePlayback={controller.prepareUploadedAudio} />
        <PresetPanel onLoadPreset={controller.loadPreset} />
      </div>
    </main>
  );
}

export default App;
