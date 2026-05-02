import { Pedal } from '../../audio/types';

type ChainTextProps = {
  pedals: Pedal[];
};

function ChainText({ pedals }: ChainTextProps) {
  return <span className="chain-text">{pedals.map((pedal) => pedal.label).join(' -> ')}</span>;
}

export default ChainText;
