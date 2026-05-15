import { useState } from 'react';

const modes = ['PLAY MODE', 'LOOPER', 'MEMORY', 'BANK / PATCH', 'EFFECT BOARD'];

function LeftModePanel() {
  const [activeMode, setActiveMode] = useState('EFFECT BOARD');

  return (
    <nav className="left-mode-panel" aria-label="Hardware modes">
      <div className="hardware-brand">
        <span>Guitar Muti-effector</span>
        <strong>Touch Multi Processor</strong>
      </div>
      <div className="mode-button-stack">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={activeMode === mode ? 'is-active' : ''}
            onClick={() => setActiveMode(mode)}
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
