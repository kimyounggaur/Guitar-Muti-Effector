import { scrollToTarget } from '../../app/scrollTargets';
import { usePedalStore } from '../../store/pedalStore';

function LeftModePanel({ onOpenBoard }: { onOpenBoard?: () => void }) {
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const openLooper = () => {
    setSelectedPedal('looper');
    window.requestAnimationFrame(() => scrollToTarget('looper'));
  };
  const openPresets = () => scrollToTarget('presets');
  return (
    <nav className="left-mode-panel" aria-label="빠른 이동">
      <div className="hardware-brand">
        <span>Guitar Multi-effector</span>
        <strong>Touch Multi Processor</strong>
      </div>
      <div className="mode-button-stack">
        <button type="button" onClick={() => { onOpenBoard?.(); scrollToTarget('board'); }}>페달 보드</button>
        <button type="button" onClick={openLooper}>루퍼 열기</button>
        <button type="button" onClick={openPresets}>프리셋 열기</button>
      </div>
      <div className="mode-encoder" aria-hidden="true"><i /></div>
    </nav>
  );
}

export default LeftModePanel;
