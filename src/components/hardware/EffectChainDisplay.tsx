import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pedal, PedalType } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';

type EffectChainDisplayProps = {
  pedals: Pedal[];
  selectedPedalId: string | null;
  onSelectPedal: (id: string) => void;
  onChainReordered?: (pedals: Pedal[]) => void;
  onPedalToggled?: (pedals: Pedal[]) => void;
};

function EffectChainDisplay({
  pedals,
  selectedPedalId,
  onSelectPedal,
  onChainReordered,
  onPedalToggled,
}: EffectChainDisplayProps) {
  const draggingPedalId = usePedalStore((state) => state.draggingPedalId);
  const togglePedal = usePedalStore((state) => state.togglePedal);
  const setDraggingPedal = usePedalStore((state) => state.setDraggingPedal);
  const reorderPedals = usePedalStore((state) => state.reorderPedals);
  const [updated, setUpdated] = useState(false);
  const pedalIds = useMemo(() => pedals.map((pedal) => pedal.id), [pedals]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
      onChainReordered?.(usePedalStore.getState().pedals);
      setUpdated(true);
      window.setTimeout(() => setUpdated(false), 1300);
    });
  };

  const handleEffectClick = (pedalId: string) => {
    onSelectPedal(pedalId);
    togglePedal(pedalId);
    window.requestAnimationFrame(() => {
      onPedalToggled?.(usePedalStore.getState().pedals);
      setUpdated(true);
      window.setTimeout(() => setUpdated(false), 1300);
    });
  };

  return (
    <div className="effect-chain-display" aria-label="Effect signal chain">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingPedal(null)}
      >
        <SortableContext items={pedalIds} strategy={rectSortingStrategy}>
          <div className={`lcd-chain-rail ${draggingPedalId ? 'is-dragging' : ''}`}>
            {pedals.map((pedal) => (
              <SortableEffectBlock
                key={pedal.id}
                pedal={pedal}
                selected={pedal.id === selectedPedalId}
                onToggle={handleEffectClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <span className={`lcd-chain-toast ${updated ? 'is-visible' : ''}`}>Signal Chain Updated</span>
    </div>
  );
}

type SortableEffectBlockProps = {
  pedal: Pedal;
  selected: boolean;
  onToggle: (id: string) => void;
};

function SortableEffectBlock({ pedal, selected, onToggle }: SortableEffectBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pedal.id });
  const palette = effectPalette[pedal.type];
  const style = {
    '--effect-color': palette.color,
    '--effect-bg': palette.bg,
    transform: CSS.Transform.toString(transform),
    transition,
  } as CSSProperties;

  return (
    <div
      ref={setNodeRef}
      className={`chain-effect-shell type-${pedal.type} ${selected ? 'is-selected' : ''} ${
        pedal.enabled ? 'is-enabled' : 'is-disabled'
      } ${pedal.bypassed ? 'is-bypassed' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={style}
    >
      <button
        type="button"
        className="chain-effect-main"
        aria-pressed={pedal.enabled}
        onClick={() => onToggle(pedal.id)}
      >
        <span>{shortLabels[pedal.type]}</span>
        <strong>{pedal.name}</strong>
        <i aria-hidden="true" />
      </button>
      <button type="button" className="chain-effect-grip" aria-label={`Move ${pedal.name}`} {...attributes} {...listeners}>
        ≡
      </button>
    </div>
  );
}

const shortLabels: Record<PedalType, string> = {
  tuner: 'TUN',
  noiseGate: 'GATE',
  compressor: 'COMP',
  drive: 'DRV',
  ampEQ: 'AMP',
  cabinetIR: 'CAB',
  modulation: 'MOD',
  delay: 'DLY',
  reverb: 'REV',
  looper: 'LOOP',
  rhythm: 'RHY',
};

const effectPalette: Record<PedalType, { color: string; bg: string }> = {
  tuner: { color: '#7cd6ff', bg: 'rgba(124, 214, 255, 0.2)' },
  noiseGate: { color: '#9fb4ad', bg: 'rgba(159, 180, 173, 0.18)' },
  compressor: { color: '#66e0bd', bg: 'rgba(102, 224, 189, 0.18)' },
  drive: { color: '#ff6f45', bg: 'rgba(255, 111, 69, 0.22)' },
  ampEQ: { color: '#f6c85f', bg: 'rgba(246, 200, 95, 0.22)' },
  cabinetIR: { color: '#35d0a3', bg: 'rgba(53, 208, 163, 0.18)' },
  modulation: { color: '#b06cff', bg: 'rgba(176, 108, 255, 0.2)' },
  delay: { color: '#5aa7ff', bg: 'rgba(90, 167, 255, 0.2)' },
  reverb: { color: '#3ee7df', bg: 'rgba(62, 231, 223, 0.18)' },
  looper: { color: '#ffcf6d', bg: 'rgba(255, 207, 109, 0.18)' },
  rhythm: { color: '#ff9a6d', bg: 'rgba(255, 154, 109, 0.18)' },
};

export default EffectChainDisplay;
