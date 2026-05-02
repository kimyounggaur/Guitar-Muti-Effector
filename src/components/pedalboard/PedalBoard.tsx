import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useMemo } from 'react';
import { Pedal, PedalPatch } from '../../audio/types';
import AddPedalMenu from './AddPedalMenu';
import ChainText from './ChainText';
import SortablePedal from './SortablePedal';

type PedalBoardProps = {
  pedals: Pedal[];
  isDragging: boolean;
  onDragStart: (event: DragStartEvent) => void;
  onDragCancel: (event: DragCancelEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onPatch: (pedalId: string, patch: PedalPatch) => void;
  onParam: (pedalId: string, key: string, value: number) => void;
};

function PedalBoard({ pedals, isDragging, onDragStart, onDragCancel, onDragEnd, onPatch, onParam }: PedalBoardProps) {
  const pedalIds = useMemo(() => pedals.map((pedal) => pedal.id), [pedals]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <section className="board-section" aria-label="Pedalboard">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Signal chain</span>
          <h2>Drag pedals to reorder</h2>
          <ChainText pedals={pedals} />
        </div>
        <div className="board-tools">
          <AddPedalMenu />
          <span className={isDragging ? 'drag-state is-active' : 'drag-state'}>
            {isDragging ? 'Audio chain held until drop' : 'Drop to rebuild chain'}
          </span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={pedalIds} strategy={horizontalListSortingStrategy}>
          <div className="pedal-chain">
            {pedals.map((pedal, index) => (
              <SortablePedal key={pedal.id} index={index} pedal={pedal} onPatch={onPatch} onParam={onParam} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

export default PedalBoard;
