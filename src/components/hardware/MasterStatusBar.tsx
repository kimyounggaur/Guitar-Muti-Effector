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
    <section className="master-status-bar" aria-label="오디오 상태">
      <StatusItem label="오디오" value={isConnecting ? '연결 중' : isAudioReady ? '연결됨' : '연결 안 됨'} live={isAudioReady} />
      <StatusItem label="입력" value={inputDeviceName} />
      <StatusItem label="샘플레이트" value={sampleRate > 0 ? `${sampleRate} Hz` : '--'} />
      <StatusItem label="출력 지연" value={latencyHint} />
      <StatusItem label="마스터" value={`${Math.round(masterVolume * 100)}%`} />
      {errorMessage ? <strong className="status-error">{errorMessage}</strong> : null}
      <button type="button" className="status-panic-button" onClick={onPanic}>
        긴급 정지
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
