import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pedal, PedalParamValue } from '../../audio/types';
import PedalCard from './PedalCard';

type SortablePedalProps = {
  pedal: Pedal;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onBypass: (id: string, bypassed: boolean) => void;
  onParamChange: (id: string, paramName: string, value: PedalParamValue) => void;
};

function SortablePedal({ pedal, selected, onSelect, onToggle, onBypass, onParamChange }: SortablePedalProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pedal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? '1.03' : '1',
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div className="sortable-pedal" ref={setNodeRef} style={style}>
      <PedalCard
        pedal={pedal}
        selected={selected}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
        isDragging={isDragging}
        onSelect={onSelect}
        onToggle={onToggle}
        onBypass={onBypass}
        onParamChange={onParamChange}
      />
    </div>
  );
}

export default SortablePedal;
