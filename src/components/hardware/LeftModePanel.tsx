import { useState } from 'react';
import { usePedalStore } from '../../store/pedalStore';

const modes = ['PLAY MODE', 'LOOPER', 'MEMORY', 'BANK / PATCH', 'EFFECT BOARD'];

function LeftModePanel() {
  const [activeMode, setActiveMode] = useState('EFFECT BOARD');
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);

  return (
    <nav className="left-mode-panel" aria-label="Hardware modes">
      <div className="hardware-brand">
        <span>Guitar Multi-effector</span>
        <strong>Touch Multi Processor</strong>
      </div>
      <div className="mode-button-stack">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={activeMode === mode ? 'is-active' : ''}
            onClick={() => {
              setActiveMode(mode);
              if (mode === 'LOOPER') {
                setSelectedPedal('looper');
                document.querySelector('.detail-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="mode-encoder" aria-hidden="true">
        <i />
      </div>
    </nav>
  );
}

export default LeftModePanel;
