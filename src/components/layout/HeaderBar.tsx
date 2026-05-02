import { ConnectionStatus } from '../../audio/types';

type HeaderBarProps = {
  status: ConnectionStatus;
  statusText: string;
};

const getStatusLabel = (status: ConnectionStatus) => {
  if (status === 'connected') {
    return 'Connected';
  }

  if (status === 'connecting') {
    return 'Connecting';
  }

  if (status === 'error') {
    return 'Needs attention';
  }

  return 'Idle';
};

function HeaderBar({ status, statusText }: HeaderBarProps) {
  return (
    <header className="app-header">
      <div className="title-block">
        <span className="eyebrow">Web Audio Multi FX</span>
        <h1>Pedalboard Lab</h1>
        <p>
          Browser-based guitar processing with AudioWorklet DSP, draggable signal flow, tuner, meters,
          and local presets.
        </p>
      </div>
      <div className={`status-pill status-${status}`}>
        <span>{getStatusLabel(status)}</span>
        <strong>{statusText}</strong>
      </div>
    </header>
  );
}

export default HeaderBar;
