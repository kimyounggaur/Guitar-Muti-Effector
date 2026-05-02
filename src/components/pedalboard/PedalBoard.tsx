const placeholderSlots = ['Slot 01', 'Slot 02', 'Slot 03', 'Slot 04', 'Slot 05'];

function PedalBoard() {
  return (
    <section className="board-section" aria-label="Pedalboard">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Signal chain</span>
          <h2>Pedalboard</h2>
        </div>
        <span className="stage-pill">Layout only</span>
      </div>

      <div className="pedal-chain">
        {placeholderSlots.map((slot) => (
          <article className="pedal-placeholder" key={slot}>
            <span>{slot}</span>
            <strong>Empty Pedal</strong>
            <p>Effect module position</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PedalBoard;
