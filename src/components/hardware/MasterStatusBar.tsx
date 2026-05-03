type MasterStatusBarProps = {
  isAudioReady: boolean;
  isConnecting: boolean;
  inputDeviceName: string;
  sampleRate: number;
  latencyHint: string;
  masterVolume: number;
  errorMessage?: string;
  onPanic: () => void;
};

function MasterStatusBar({
  isAudioReady,
  isConnecting,
  inputDeviceName,
  sampleRate,
  latencyHint,
  masterVolume,
  errorMessage = '',
  onPanic,
}: MasterStatusBarProps) {
  return (
    <section className="master-status-bar" aria-label="Master status">
      <StatusItem label="Audio" value={isConnecting ? 'Connecting' : isAudioReady ? 'Connected' : 'Disconnected'} live={isAudioReady} />
      <StatusItem label="Input" value={inputDeviceName} />
      <StatusItem label="Sample" value={sampleRate > 0 ? `${sampleRate} Hz` : '--'} />
      <StatusItem label="Latency" value={latencyHint} />
      <StatusItem label="CPU" value="--" />
      <StatusItem label="Master" value={`${Math.round(masterVolume * 100)}%`} />
      {errorMessage ? <strong className="status-error">{errorMessage}</strong> : null}
      <button type="button" className="status-panic-button" onClick={onPanic}>
        PANIC
      </button>
    </section>
  );
}

function StatusItem({ label, value, live = false }: { label: string; value: string; live?: boolean }) {
  return (
    <span className={`master-status-item ${live ? 'is-live' : ''}`}>
      <b>{label}</b>
      <strong>{value}</strong>
    </span>
  );
}

export default MasterStatusBar;
