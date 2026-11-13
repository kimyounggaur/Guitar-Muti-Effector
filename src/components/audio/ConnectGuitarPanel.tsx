import { useEffect, useRef, useState } from 'react';
import DeviceSelector from './DeviceSelector';
import { useAudioStore } from '../../store/audioStore';
import type { InputChannel } from '../../audio/AudioEngine';

type ConnectGuitarPanelProps = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputDevices: MediaDeviceInfo[];
  errorMessage: string;
  onConnect: () => void;
  onStop: () => void;
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
          setDeviceNotice('선택한 입력 장치가 연결 해제되어 오디오를 정지했습니다. 장치를 다시 연결하고 선택해 주세요.');
        } else if (isAudioReady && !selectedDeviceId) {
          setDeviceNotice('오디오 장치 구성이 변경되었습니다. 입력과 소리가 정상인지 확인해 주세요.');
        }
        previouslyPresent = present;
      } catch {
        if (!cancelled) setDeviceNotice('오디오 장치 목록을 확인할 수 없습니다. 연결 상태를 확인해 주세요.');
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
      setOutputNotice(audioErrorHelp(error));
    } finally { setOutputChanging(false); }
  };

  useEffect(() => { if (isConnecting) setDeviceNotice(''); }, [isConnecting]);
  return (
    <section className="connect-section" aria-label="Guitar input connection">
      <div className="panel-heading">
        <span>Input</span>
        <strong>{isAudioReady ? '오디오 연결됨' : '오디오 정지됨'}</strong>
      </div>

      <div className="connect-grid">
        <div className="connection-card">
          <button className="connect-button" type="button" onClick={onConnect} disabled={isConnecting}>
            {isConnecting ? '연결 중...' : '기타 연결하기'}
          </button>
          <button className="stop-button" type="button" onClick={onStop} disabled={!isAudioReady && !isConnecting}>
            오디오 정지
          </button>
        </div>

        <DeviceSelector
          inputDevices={inputDevices}
          selectedDeviceId={selectedDeviceId}
          disabled={isConnecting}
          onChange={onDeviceChange}
        />

        <label className="device-selector" htmlFor="audio-input-channel">
          <span>기타 입력 채널 (양쪽 출력)</span>
          <select id="audio-input-channel" value={inputChannel} onChange={(event) => setInputChannel(event.target.value as InputChannel)}>
            <option value="1">입력 1</option>
            <option value="2">입력 2</option>
            <option value="mix">입력 1 + 2 합치기</option>
          </select>
        </label>

        <label className="device-selector" htmlFor="audio-output-device">
          <span>소리 출력 장치</span>
          <select id="audio-output-device" value={selectedOutputDeviceId}
            disabled={!isAudioReady || isConnecting || outputChanging || !outputSupported}
            onChange={(event) => void changeOutput(event.target.value)}>
            <option value="">시스템 기본 출력</option>
            {outputDevices.filter((device) => device.deviceId && device.deviceId !== 'default').map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || `출력 장치 ${index + 1}`}</option>
            ))}
          </select>
          {!outputSupported && <small>이 브라우저에서는 시스템 소리 설정에서 출력 장치를 변경해 주세요.</small>}
        </label>

        <div className="safety-card">
          <strong>안전하게 시작하기</strong>
          <ul>
            <li>실시간 모니터링 시 헤드폰을 사용하세요.</li>
            <li>오디오 인터페이스의 직접 모니터링을 끄세요.</li>
            <li>출력 음량을 낮게 설정하고 시작하세요.</li>
          </ul>
        </div>
      </div>

      <InputSafetyNotice isAudioReady={isAudioReady} />
      {deviceNotice ? <p role="status" className="error-message">{deviceNotice}</p> : null}
      {outputNotice ? <p role="alert" className="error-message">{outputNotice}</p> : null}
      {errorMessage ? <p role="alert" className="error-message">{audioErrorHelp(errorMessage)}</p> : null}
    </section>
  );
}

export function audioErrorHelp(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  if (/NotAllowedError|Permission denied|permission.*denied|not allowed/i.test(message))
    return '마이크 또는 출력 장치 권한이 거부되었습니다. 브라우저 주소창의 사이트 권한을 허용한 뒤 다시 연결해 주세요.';
  if (/NotFoundError|Requested device not found|device.*not found/i.test(message))
    return '선택한 오디오 장치를 찾을 수 없습니다. 장치 연결을 확인하고 다시 선택해 주세요.';
  if (/NotReadableError|Could not start audio source|device.*busy/i.test(message))
    return '오디오 장치에 접근할 수 없습니다. 다른 앱에서 장치를 사용 중인지 확인해 주세요.';
  if (/OverconstrainedError/i.test(message)) return '선택한 장치를 사용할 수 없습니다. 다른 입력 장치를 선택해 주세요.';
  if (/AbortError/i.test(message)) return '오디오 연결이 취소되었습니다. 필요하면 다시 연결해 주세요.';
  return message || '오디오 설정을 변경하지 못했습니다. 장치 연결과 브라우저 권한을 확인해 주세요.';
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
  return <p role="status" className="error-message">입력 신호가 너무 큽니다. 오디오 인터페이스의 입력 게인을 낮춰 주세요.</p>;
}

export default ConnectGuitarPanel;
