function MasterSection() {
  return (
    <section className="master-section" aria-label="Master controls">
      <div className="panel-heading">
        <span>Master</span>
        <strong>Control positions</strong>
      </div>
      <div className="master-grid">
        <div className="meter-shell">
          <span>Input</span>
          <i />
        </div>
        <div className="meter-shell">
          <span>Output</span>
          <i />
        </div>
        <div className="volume-shell">
          <span>Master Volume</span>
          <div className="fake-slider">
            <i />
          </div>
        </div>
        <button type="button" className="panic-button">
          Panic
        </button>
      </div>
    </section>
  );
}

export default MasterSection;
