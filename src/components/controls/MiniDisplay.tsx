type MiniDisplayProps = {
  eyebrow: string;
  value: string;
  subValue?: string;
  tuned?: boolean;
};

function MiniDisplay({ eyebrow, value, subValue, tuned = false }: MiniDisplayProps) {
  return (
    <div className={tuned ? 'mini-display is-tuned' : 'mini-display'}>
      <span>{eyebrow}</span>
      <strong>{value}</strong>
      {subValue ? <output>{subValue}</output> : null}
    </div>
  );
}

export default MiniDisplay;
