import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pedal, PedalPatch } from '../../audio/types';
import AmpEQPedal from '../effects/AmpEQPedal';
import CabinetIRPedal from '../effects/CabinetIRPedal';
import CompressorPedal from '../effects/CompressorPedal';
import DelayPedal from '../effects/DelayPedal';
import DrivePedal from '../effects/DrivePedal';
import NoiseGatePedal from '../effects/NoiseGatePedal';
import ReverbPedal from '../effects/ReverbPedal';
import PedalCard, { PedalCardProps } from './PedalCard';

type SortablePedalProps = {
  index: number;
  pedal: Pedal;
  onPatch: (pedalId: string, patch: PedalPatch) => void;
  onParam: (pedalId: string, key: string, value: number) => void;
};

const renderPedal = (props: PedalCardProps) => {
  if (props.pedal.type === 'noiseGate') {
    return <NoiseGatePedal {...props} />;
  }

  if (props.pedal.type === 'compressor') {
    return <CompressorPedal {...props} />;
  }

  if (props.pedal.type === 'drive') {
    return <DrivePedal {...props} />;
  }

  if (props.pedal.type === 'ampEq') {
    return <AmpEQPedal {...props} />;
  }

  if (props.pedal.type === 'cabinet') {
    return <CabinetIRPedal {...props} />;
  }

  if (props.pedal.type === 'delay') {
    return <DelayPedal {...props} />;
  }

  if (props.pedal.type === 'reverb') {
    return <ReverbPedal {...props} />;
  }

  return <PedalCard {...props} />;
};

function SortablePedal({ index, pedal, onPatch, onParam }: SortablePedalProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pedal.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="pedal-slot" ref={setNodeRef}>
      {renderPedal({
        index,
        pedal,
        isDragging,
        style,
        dragHandle: {
          attributes: attributes as unknown as Record<string, unknown>,
          listeners: listeners as unknown as Record<string, unknown>,
        },
        onPatch,
        onParam,
      })}
    </div>
  );
}

export default SortablePedal;
