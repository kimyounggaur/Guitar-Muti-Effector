type HeaderBarProps = {
  appName: string;
  connectionStatus: string;
  presetName: string;
};

function HeaderBar({ appName, connectionStatus, presetName }: HeaderBarProps) {
  return (
    <header className="app-header">
      <div className="title-block">
        <span className="eyebrow">Web Guitar Multi FX</span>
        <h1>{appName}</h1>
      </div>
      <div className="header-status" aria-label="Project status">
        <div className="status-card">
          <span>Connection</span>
          <strong>{connectionStatus}</strong>
        </div>
        <div className="status-card">
          <span>Preset</span>
          <strong>{presetName}</strong>
        </div>
      </div>
    </header>
  );
}

export default HeaderBar;
