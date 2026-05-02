import { Pedal } from '../../audio/types';

type ChainTextProps = {
  pedals: Pedal[];
};

function ChainText({ pedals }: ChainTextProps) {
  const names = pedals.map((pedal) => pedal.name).join(' → ');

  return <p className="chain-text">Guitar Input → {names} → Output</p>;
}

export default ChainText;
