import { ReactNode } from 'react';

type PedalSlotProps = {
  children: ReactNode;
};

function PedalSlot({ children }: PedalSlotProps) {
  return <div className="pedal-slot">{children}</div>;
}

export default PedalSlot;
