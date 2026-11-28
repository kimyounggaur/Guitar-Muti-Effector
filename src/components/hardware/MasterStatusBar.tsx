import '../../styles/components/status-bar.css';
import { t } from '../../i18n/ko';
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
    <section className="master-status-bar" aria-label={t('panel.status.region')}>
      <StatusItem label={t('panel.status.audio')} value={isConnecting ? t('panel.status.connecting') : isAudioReady ? t('panel.status.connected') : t('panel.status.disconnected')} live={isAudioReady} />
      <StatusItem label={t('panel.connect.title')} value={inputDeviceName} />
      <StatusItem label={t('panel.status.sampleRate')} value={sampleRate > 0 ? `${sampleRate} Hz` : '--'} />
      <StatusItem label={t('panel.status.latency')} value={latencyHint} />
      <StatusItem label={t('panel.utility.master')} value={`${Math.round(masterVolume * 100)}%`} />
      {errorMessage ? <strong className="status-error">{errorMessage}</strong> : null}
      <button type="button" className="status-panic-button" onClick={onPanic}>
        
        {t('panel.status.panic')}
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
