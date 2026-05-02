type ToggleSwitchProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i />
    </label>
  );
}

export default ToggleSwitch;
