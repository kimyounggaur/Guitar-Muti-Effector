type FootSwitchProps = {
  label: string;
  active?: boolean;
  variant?: 'normal' | 'warning';
  onClick: () => void;
};

function FootSwitch({ label, active = false, variant = 'normal', onClick }: FootSwitchProps) {
  return (
    <button
      type="button"
      className={`state-button ${active ? 'is-on' : ''} ${variant === 'warning' ? 'is-bypassed' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default FootSwitch;
