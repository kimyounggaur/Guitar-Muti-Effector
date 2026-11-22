// Audio orchestration moved out of App.tsx (design §3.5). Bodies are the previous App handlers, unchanged.
// Only this file and AudioControllerContext.tsx may import the AudioEngine.
import type { AudioEngine } from '../audio/AudioEngine';
import type { InputChannel, Pedal, PedalParamValue } from '../audio/types';
import { useAudioStore } from '../store/audioStore';
import { usePedalStore } from '../store/pedalStore';
import type { PedalboardPreset } from '../store/presetStore';
import { useTempoStore } from '../store/tempoStore';

export type AudioController = ReturnType<typeof createAudioController>;

export function createAudioController(engine: AudioEngine) {
  const audio = () => useAudioStore.getState();
  // Each connect/switch/stop/panic starts a new generation; late results of older ones are ignored.
  let operation = 0;

  /**
   * Shared runner: new generation → connecting → task → (error: message if still current) → idle if still current.
   * checkOnError is false only for stop, which always reported its error.
   */
  const run = async (
    task: (isCurrent: () => boolean) => Promise<void>,
    fallbackMessage: string,
    { onError, checkOnError = true }: { onError?: () => void; checkOnError?: boolean } = {},
  ) => {
    const current = ++operation;
    const isCurrent = () => current === operation;
    audio().setIsConnecting(true);
    audio().setErrorMessage('');
    try {
      await task(isCurrent);
    } catch (error) {
      if (checkOnError && !isCurrent()) return;
      onError?.();
      audio().setErrorMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      if (isCurrent()) audio().setIsConnecting(false);
    }
  };

  const refreshInputDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    audio().setInputDevices(devices.filter((device) => device.kind === 'audioinput'));
  };

  const rebuildChain = (pedals: Pedal[] = usePedalStore.getState().pedals) => {
    try {
      engine.rebuildChain(pedals);
    } catch (error) {
      audio().setErrorMessage(error instanceof Error ? error.message : 'Could not rebuild audio chain.');
    }
  };

  const connect = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      audio().setErrorMessage('이 브라우저는 오디오 입력을 지원하지 않습니다. HTTPS 주소에서 최신 Chrome 또는 Safari로 다시 열어 주세요.');
      return;
    }

    const selectedDeviceId = audio().selectedDeviceId;
    await run(async (isCurrent) => {
      const state = await engine.connect(selectedDeviceId, 0);
      if (!isCurrent()) return;
      engine.setTempo(useTempoStore.getState().bpm);
      engine.setMasterVolume(audio().masterVolume);
      audio().setSampleRate(state.sampleRate);
      audio().setLatencyHint(state.latencyHint);
      audio().setAudioReady(true);
      engine.rebuildChain(usePedalStore.getState().pedals);
      await refreshInputDevices();
    }, 'Could not connect guitar input.', { onError: () => audio().setAudioReady(false) });
  };

  const switchInput = async (deviceId: string) => {
    audio().setSelectedDeviceId(deviceId);

    if (!audio().isAudioReady) {
      return;
    }

    await run(async (isCurrent) => {
      const state = await engine.switchDevice(deviceId, 0);
      if (!isCurrent()) return;
      engine.setMasterVolume(audio().masterVolume);
      audio().setSampleRate(state.sampleRate);
      audio().setLatencyHint(state.latencyHint);
      engine.rebuildChain(usePedalStore.getState().pedals);
      await refreshInputDevices();
    }, 'Could not switch input device.', { onError: () => audio().setAudioReady(false) });
  };

  const stop = () =>
    run(async (isCurrent) => {
      await engine.stop();
      if (!isCurrent()) return;
      audio().resetAudioState();
    }, 'Could not stop audio.', { checkOnError: false });

  const panic = async () => {
    const current = ++operation;
    audio().setIsConnecting(true);
    // Silence first, synchronously, before anything can be awaited.
    audio().setMasterVolume(0);
    engine.setMasterVolume(0);
    engine.panicDisconnect();
    audio().resetAudioState();
    audio().setIsConnecting(true);
    try { await engine.stop(); }
    catch { audio().setErrorMessage('오디오를 정지하는 중 오류가 발생했습니다. 입력 장치를 확인해 주세요.'); }
    finally { if (current === operation) audio().setIsConnecting(false); }
  };

  const prepareUploadedAudio = async (audioElement: HTMLAudioElement) => {
    const current = ++operation;
    audio().setIsConnecting(true);
    audio().setErrorMessage('');

    try {
      const state = await engine.connectUploadedAudio(audioElement, 0, usePedalStore.getState().pedals);
      if (current !== operation) throw new DOMException('오디오 연결이 취소되었습니다.', 'AbortError');
      engine.setMasterVolume(audio().masterVolume);
      audio().setSampleRate(state.sampleRate);
      audio().setLatencyHint(state.latencyHint);
      audio().setAudioReady(true);
    } catch (error) {
      if (current !== operation) throw error;
      const message = error instanceof Error ? error.message : 'Could not route uploaded audio through effects.';
      audio().setAudioReady(false);
      audio().setErrorMessage(message);
      throw new Error(message);
    } finally {
      if (current === operation) audio().setIsConnecting(false);
    }
  };

  const loadPreset = (preset: PedalboardPreset) => {
    audio().setPresetTrimDb(preset.outputTrimDb);
    usePedalStore.getState().setPedals(preset.pedals);
    useTempoStore.getState().setBpm(preset.tempoBpm);

    window.requestAnimationFrame(() => {
      const nextPedals = usePedalStore.getState().pedals;
      rebuildChain(nextPedals);
    });
  };

  const togglePedal = (pedalId: string) => {
    usePedalStore.getState().togglePedal(pedalId);
    window.requestAnimationFrame(() => rebuildChain(usePedalStore.getState().pedals));
  };

  const footSwitchToggle = (pedalId: string) => {
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

    window.requestAnimationFrame(() => rebuildChain(usePedalStore.getState().pedals));
  };

  const setPedalBypass = (pedalId: string, bypassed: boolean) => {
    const pedal = usePedalStore.getState().pedals.find((item) => item.id === pedalId);
    engine.setPedalBypass(pedalId, bypassed || !pedal?.enabled);
  };

  const setParam = (pedalId: string, paramName: string, value: PedalParamValue) => {
    engine.setPedalParam(pedalId, paramName, value);
  };

  const setMasterVolume = (volume: number) => {
    audio().setMasterVolume(volume);
    engine.setMasterVolume(volume);
  };

  const setExpression = (value: number) => {
    audio().setExpression(value);
    engine.setExpression(audio().expression);
  };

  const setInputChannel = (channel: InputChannel) => audio().setInputChannel(channel);
  const setOutputDevice = (deviceId: string) => engine.setOutputDevice(deviceId);
  const tapTempo = () => { useTempoStore.getState().tapTempo(); };
  const readMeters = () => [engine.readInputMeter(), engine.readOutputMeter()] as const;

  /** Engine events and store → engine subscriptions. Returns the detach function. */
  const attach = () => {
    engine.setErrorHandler(audio().setErrorMessage);
    engine.setInputEndedHandler(() => {
      ++operation;
      audio().resetAudioState();
      audio().setMasterVolume(0);
      audio().setErrorMessage('입력 장치 연결이 끊겨 오디오를 정지했습니다. 장치를 확인하고 다시 연결해 주세요.');
    });
    // The tempo lives in tempoStore only; the engine forwards it to tempo-aware effects.
    engine.setTempo(useTempoStore.getState().bpm);
    const unsubscribeTempo = useTempoStore.subscribe((state, previous) => {
      if (state.bpm !== previous.bpm) engine.setTempo(state.bpm);
    });
    engine.setPresetTrimDb(audio().presetTrimDb);
    engine.setInputChannel(audio().inputChannel);
    const unsubscribeAudio = useAudioStore.subscribe((state, previous) => {
      if (state.presetTrimDb !== previous.presetTrimDb) engine.setPresetTrimDb(state.presetTrimDb);
      if (state.inputChannel !== previous.inputChannel) engine.setInputChannel(state.inputChannel);
    });
    return () => {
      engine.setErrorHandler(null);
      engine.setInputEndedHandler(null);
      unsubscribeTempo();
      unsubscribeAudio();
    };
  };

  return {
    attach,
    connect,
    switchInput,
    setInputChannel,
    setOutputDevice,
    stop,
    panic,
    prepareUploadedAudio,
    loadPreset,
    togglePedal,
    footSwitchToggle,
    setPedalBypass,
    setParam,
    rebuildChain,
    setMasterVolume,
    setExpression,
    tapTempo,
    refreshInputDevices,
    readMeters,
  };
}
