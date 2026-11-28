import { useEffect, useRef, useState } from 'react';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import DeviceSelector from './DeviceSelector';
import { useAudioStore } from '../../store/audioStore';
import type { InputChannel } from '../../audio/types';
import '../../styles/components/connect-panel.css';
import { t } from '../../i18n/ko';
import { toUserMessage } from '../../app/userMessage';

type ConnectGuitarPanelProps = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputDevices: MediaDeviceInfo[];
  errorMessage: string;
  onConnect: () => void;
  onStop: () => void;
  onPanic: () => void;
  onDeviceChange: (deviceId: string) => void;
  onOutputDeviceChange: (deviceId: string) => Promise<void>;
};

function ConnectGuitarPanel({
  isAudioReady,
  isConnecting,
  selectedDeviceId,
  inputDevices,
  errorMessage,
  onConnect,
  onStop,
  onPanic,
  onDeviceChange,
  onOutputDeviceChange,
}: ConnectGuitarPanelProps) {
  const inputChannel = useAudioStore((state) => state.inputChannel);
  const setInputChannel = useAudioStore((state) => state.setInputChannel);
  const setInputDevices = useAudioStore((state) => state.setInputDevices);
  const outputDevices = useAudioStore((state) => state.outputDevices);
  const selectedOutputDeviceId = useAudioStore((state) => state.selectedOutputDeviceId);
  const setOutputDevices = useAudioStore((state) => state.setOutputDevices);
  const setSelectedOutputDeviceId = useAudioStore((state) => state.setSelectedOutputDeviceId);
  const [outputNotice, setOutputNotice] = useState('');
  const [outputChanging, setOutputChanging] = useState(false);
  const outputSupported = typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
  const [deviceNotice, setDeviceNotice] = useState('');
  const isPhone = usePhoneLayout();
  const stopRef = useRef(onStop);
  stopRef.current = onStop;

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.addEventListener || !media.enumerateDevices) return;
    let cancelled = false;
    let previouslyPresent = !!selectedDeviceId && inputDevices.some((d) => d.deviceId === selectedDeviceId);
    const onDeviceListChange = async () => {
      try {
        const devices = (await media.enumerateDevices()).filter((d) => d.kind === 'audioinput');
        if (cancelled) return;
        setInputDevices(devices);
        const present = devices.some((d) => d.deviceId === selectedDeviceId);
        if (isAudioReady && selectedDeviceId && previouslyPresent && !present) {
          stopRef.current();
          setDeviceNotice(t('error.deviceRemoved'));
        } else if (isAudioReady && !selectedDeviceId) {
          setDeviceNotice(t('error.deviceChanged'));
        }
        previouslyPresent = present;
      } catch {
        if (!cancelled) setDeviceNotice(t('error.deviceListFailed'));
      }
    };
    media.addEventListener('devicechange', onDeviceListChange);
    return () => { cancelled = true; media.removeEventListener('devicechange', onDeviceListChange); };
  }, [isAudioReady, selectedDeviceId, inputDevices, setInputDevices]);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) return;
    let cancelled = false;
    const refresh = () => { void media.enumerateDevices().then((devices) => {
      if (!cancelled) setOutputDevices(devices.filter((device) => device.kind === 'audiooutput'));
    }).catch(() => { if (!cancelled) setOutputDevices([]); }); };
    refresh();
    media.addEventListener?.('devicechange', refresh);
    return () => { cancelled = true; media.removeEventListener?.('devicechange', refresh); };
  }, [isAudioReady, setOutputDevices]);

  const changeOutput = async (id: string) => {
    setOutputChanging(true);
    setOutputNotice('');
    try {
      await onOutputDeviceChange(id);
      setSelectedOutputDeviceId(id);
    } catch (error) {
      setOutputNotice(toUserMessage(error));
    } finally { setOutputChanging(false); }
  };

  useEffect(() => { if (isConnecting) setDeviceNotice(''); }, [isConnecting]);
  const connectButton = (
    <button className="connect-button" type="button" onClick={onConnect} disabled={isConnecting}>
      {isConnecting ? t('panel.connect.connecting') : t('panel.connect.connect')}
    </button>
  );
  const stopButton = (
    <button className="stop-button" type="button" onClick={onStop} disabled={!isAudioReady && !isConnecting}>
      {t('panel.connect.stop')}
    </button>
  );
  const panicButton = (
    <button className="panic-button" type="button" onClick={onPanic}>{t('panel.app.panic')}</button>
  );
  const settings = (
    <>
      <DeviceSelector
        inputDevices={inputDevices}
        selectedDeviceId={selectedDeviceId}
        disabled={isConnecting}
        onChange={onDeviceChange}
      />

      <label className="device-selector" htmlFor="audio-input-channel">
        <span>{t('input.channel')}</span>
        <select id="audio-input-channel" value={inputChannel} onChange={(event) => setInputChannel(event.target.value as InputChannel)}>
          <option value="1">{t('input.channel1')}</option>
          <option value="2">{t('input.channel2')}</option>
          <option value="mix">{t('input.channelMix')}</option>
        </select>
      </label>

      <label className="device-selector" htmlFor="audio-output-device">
        <span>{t('output.device')}</span>
        <select id="audio-output-device" value={selectedOutputDeviceId}
          disabled={!isAudioReady || isConnecting || outputChanging || !outputSupported}
          onChange={(event) => void changeOutput(event.target.value)}>
          <option value="">{t('output.defaultDevice')}</option>
          {outputDevices.filter((device) => device.deviceId && device.deviceId !== 'default').map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>{device.label || t('output.deviceN', { n: index + 1 })}</option>
          ))}
        </select>
        {!outputSupported && <small>{t('output.notSupportedHint')}</small>}
      </label>
    </>
  );
  const safety = (
    <div className="safety-card">
      <strong>{t('panel.connect.safetyTitle')}</strong>
      <ul>
        <li>{t('panel.connect.safety1')}</li>
        <li>{t('panel.connect.safety2')}</li>
        <li>{t('panel.connect.safety3')}</li>
      </ul>
    </div>
  );
  const notices = (
    <>
      <InputSafetyNotice isAudioReady={isAudioReady} />
      {deviceNotice && <p role="status" className="error-message">{deviceNotice}</p>}
      {outputNotice && <p role="alert" className="error-message">{outputNotice}</p>}
      {errorMessage && <p role="alert" className="error-message">{errorMessage}</p>}
    </>
  );

  if (isPhone) {
    return (
      <>
        <div className="mobile-control-bar" role="group" aria-label={t('panel.connect.region')}>
          {isAudioReady || isConnecting ? stopButton : connectButton}
          <MobileInputMeter />
          {panicButton}
        </div>
        <div className="mobile-input-options">
          {!isAudioReady && (
            <details className="mobile-safety">
              <summary>{t('panel.connect.safetyLine')} <span>{t('panel.common.details')}</span></summary>
              {safety}
            </details>
          )}
          <details className="mobile-settings">
            <summary>{t('panel.connect.settings')}</summary>
            {settings}
          </details>
          {notices}
        </div>
      </>
    );
  }
  return (
    <>
      <section className="connect-section" aria-label={t('panel.connect.region')}>
        <div className="panel-heading">
          <span>{t('panel.connect.title')}</span>
          <strong>{isAudioReady ? t('panel.connect.connected') : t('panel.connect.stopped')}</strong>
        </div>
        <div className="connect-grid">
          <div className="connection-card">{connectButton}{stopButton}</div>
          <div className="connect-settings">{settings}</div>
          {safety}
        </div>
        {notices}
      </section>
      {panicButton}
    </>
  );
}

/** Thin input level bar for the phone top bar (hidden on wider screens). */
function MobileInputMeter() {
  const rmsDb = useAudioStore((state) => state.inputMeter.rmsDb);
  const fill = Math.min(100, Math.max(0, ((rmsDb + 60) / 60) * 100));
  return (
    <span className="mobile-only mobile-input-meter" role="meter" aria-label={t('input.level')} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(Math.max(-60, rmsDb))}>
      <i style={{ width: `${fill}%` }} />
    </span>
  );
}

// Subscribe separately so meter updates do not redraw device selection controls.
function InputSafetyNotice({ isAudioReady }: { isAudioReady: boolean }) {
  const clipping = useAudioStore((state) => state.inputMeter.isClipping);
  const warning = useAudioStore((state) => state.inputMeter.isWarning);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (clipping && isAudioReady) { setHeld(true); return; }
    const timer = window.setTimeout(() => setHeld(false), 2000);
    return () => window.clearTimeout(timer);
  }, [clipping, isAudioReady]);
  if (!isAudioReady || (!held && !warning)) return null;
  return <p role="status" className="error-message">{t('error.inputTooLoud')}</p>;
}

export default ConnectGuitarPanel;
