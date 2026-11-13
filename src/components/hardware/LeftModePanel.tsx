import { usePedalStore } from '../../store/pedalStore';

function LeftModePanel({ onOpenBoard }: { onOpenBoard?: () => void }) {
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const openLooper = () => {
    setSelectedPedal('looper');
    window.requestAnimationFrame(() => document.querySelector('.detail-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openPresets = () => {
    const details = document.querySelector<HTMLDetailsElement>('.preset-browser-frame');
    if (details) {
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  return (
    <nav className="left-mode-panel" aria-label="빠른 이동">
      <div className="hardware-brand">
        <span>Guitar Multi-effector</span>
        <strong>Touch Multi Processor</strong>
      </div>
      <div className="mode-button-stack">
        <button type="button" onClick={() => { onOpenBoard?.(); document.querySelector('.central-screen')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>페달 보드</button>
        <button type="button" onClick={openLooper}>루퍼 열기</button>
        <button type="button" onClick={openPresets}>프리셋 열기</button>
      </div>
      <div className="mode-encoder" aria-hidden="true"><i /></div>
    </nav>
  );
}

export default LeftModePanel;
