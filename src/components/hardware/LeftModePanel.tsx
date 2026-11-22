import { scrollToTarget } from '../../app/scrollTargets';
import { usePedalStore } from '../../store/pedalStore';
import '../../styles/components/left-panel.css';
import { t } from '../../i18n/ko';

function LeftModePanel({ onOpenBoard }: { onOpenBoard?: () => void }) {
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const openLooper = () => {
    setSelectedPedal('looper');
    window.requestAnimationFrame(() => scrollToTarget('looper'));
  };
  const openPresets = () => scrollToTarget('presets');
  return (
    <nav className="left-mode-panel" aria-label={t('panel.left.region')}>
      <div className="hardware-brand">
        <span>{t('panel.left.brand')}</span>
        <strong>{t('panel.left.brandSub')}</strong>
      </div>
      <div className="mode-button-stack">
        <button type="button" onClick={() => { onOpenBoard?.(); scrollToTarget('board'); }}>{t('panel.left.board')}</button>
        <button type="button" onClick={openLooper}>{t('panel.left.looper')}</button>
        <button type="button" onClick={openPresets}>{t('panel.left.presets')}</button>
      </div>
      <div className="mode-encoder" aria-hidden="true"><i /></div>
    </nav>
  );
}

export default LeftModePanel;
