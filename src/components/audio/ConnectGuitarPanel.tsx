import DeviceSelector from './DeviceSelector';

type ConnectGuitarPanelProps = {
  isAudioReady: boolean;
  isConnecting: boolean;
  selectedDeviceId: string;
  inputDevices: MediaDeviceInfo[];
  errorMessage: string;
  onConnect: () => void;
  onStop: () => void;
  onDeviceChange: (deviceId: string) => void;
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
}: ConnectGuitarPanelProps) {
  return (
    <section className="connect-section" aria-label="Guitar input connection">
      <div className="panel-heading">
        <span>Input</span>
        <strong>{isAudioReady ? 'Audio is live' : 'Audio is stopped'}</strong>
      </div>

      <div className="connect-grid">
        <div className="connection-card">
          <button className="connect-button" type="button" onClick={onConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : '기타 연결하기'}
          </button>
          <button className="stop-button" type="button" onClick={onStop} disabled={!isAudioReady && !isConnecting}>
            Stop Audio
          </button>
        </div>

        <DeviceSelector
          inputDevices={inputDevices}
          selectedDeviceId={selectedDeviceId}
          disabled={isConnecting}
          onChange={onDeviceChange}
        />

        <div className="safety-card">
          <strong>Safe start</strong>
          <ul>
            <li>Use headphones when testing live monitoring.</li>
            <li>Turn off Direct Monitor on your audio interface.</li>
            <li>Start with your output volume low.</li>
          </ul>
        </div>
      </div>

      {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
    </section>
  );
}

export default ConnectGuitarPanel;
