type SelectOption = {
  value: string;
  label: string;
};

type SelectControlProps = {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

function SelectControl({ id, label, value, options, onChange }: SelectControlProps) {
  return (
    <label className="select-control" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default SelectControl;
