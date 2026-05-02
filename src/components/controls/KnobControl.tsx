type KnobControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function KnobControl({ label, value, min, max, onChange }: KnobControlProps) {
  const normalized = (value - min) / (max - min || 1);
  const degrees = -135 + normalized * 270;

  return (
    <label className="knob-control">
      <span>{label}</span>
      <input type="range" min={min} max={max} step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <i style={{ transform: `rotate(${degrees}deg)` }} />
    </label>
  );
}

export default KnobControl;
