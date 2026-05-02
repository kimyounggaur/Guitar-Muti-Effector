import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
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
import { Pedal, PedalParamValue } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';
import ChainText from './ChainText';
import SortablePedal from './SortablePedal';

type PedalBoardProps = {
  onChainReordered?: (pedals: Pedal[]) => void;
  onPedalToggled?: (pedals: Pedal[]) => void;
  onPedalBypassChanged?: (pedalId: string, bypassed: boolean) => void;
  onPedalParamChanged?: (pedalId: string, paramName: string, value: PedalParamValue) => void;
};

function PedalBoard({
  onChainReordered,
  onPedalToggled,
  onPedalBypassChanged,
  onPedalParamChanged,
}: PedalBoardProps) {
  const pedals = usePedalStore((state) => state.pedals);
  const selectedPedalId = usePedalStore((state) => state.selectedPedalId);
  const draggingPedalId = usePedalStore((state) => state.draggingPedalId);
  const togglePedal = usePedalStore((state) => state.togglePedal);
  const setPedalBypass = usePedalStore((state) => state.setPedalBypass);
  const updatePedalParam = usePedalStore((state) => state.updatePedalParam);
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const setDraggingPedal = usePedalStore((state) => state.setDraggingPedal);
  const reorderPedals = usePedalStore((state) => state.reorderPedals);
  const resetPedals = usePedalStore((state) => state.resetPedals);
  const savePedalsToStorage = usePedalStore((state) => state.savePedalsToStorage);
  const loadPedalsFromStorage = usePedalStore((state) => state.loadPedalsFromStorage);
  const [showToast, setShowToast] = useState(false);
  const pedalIds = useMemo(() => pedals.map((pedal) => pedal.id), [pedals]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    loadPedalsFromStorage();
  }, [loadPedalsFromStorage]);

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setShowToast(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [showToast]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingPedal(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingPedal(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = pedals.findIndex((pedal) => pedal.id === active.id);
    const newIndex = pedals.findIndex((pedal) => pedal.id === over.id);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }

    reorderPedals(oldIndex, newIndex);
    window.requestAnimationFrame(() => {
      const nextPedals = usePedalStore.getState().pedals;
      onChainReordered?.(nextPedals);
      setShowToast(true);
    });
  };

  const handleDragCancel = () => {
    setDraggingPedal(null);
  };

  const handleToggle = (id: string) => {
    togglePedal(id);
    window.requestAnimationFrame(() => onPedalToggled?.(usePedalStore.getState().pedals));
  };

  const handleBypass = (id: string, bypassed: boolean) => {
    setPedalBypass(id, bypassed);
    onPedalBypassChanged?.(id, bypassed);
  };

  const handleParamChange = (id: string, paramName: string, value: PedalParamValue) => {
    updatePedalParam(id, paramName, value);
    onPedalParamChanged?.(id, paramName, value);
  };

  const handleReset = () => {
    resetPedals();
    window.requestAnimationFrame(() => onPedalToggled?.(usePedalStore.getState().pedals));
  };

  return (
    <section className="board-section" aria-label="Pedalboard">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Signal chain</span>
          <h2>Pedalboard</h2>
          <ChainText pedals={pedals} />
        </div>
        <div className="board-actions">
          <button type="button" onClick={savePedalsToStorage}>
            Save Chain
          </button>
          <button type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={pedalIds} strategy={horizontalListSortingStrategy}>
          <div className={`pedal-chain ${draggingPedalId ? 'is-dragging' : ''}`}>
            {pedals.map((pedal) => (
              <SortablePedal
                key={pedal.id}
                pedal={pedal}
                selected={pedal.id === selectedPedalId}
                onSelect={setSelectedPedal}
                onToggle={handleToggle}
                onBypass={handleBypass}
                onParamChange={handleParamChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className={`chain-toast ${showToast ? 'is-visible' : ''}`} role="status">
        Signal Chain Updated
      </div>
    </section>
  );
}

export default PedalBoard;
