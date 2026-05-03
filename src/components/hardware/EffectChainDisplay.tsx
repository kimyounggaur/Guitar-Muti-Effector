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
        className="chain-effect-main chain-effect-svg-button"
        aria-pressed={pedal.enabled}
        aria-label={`${pedal.name} ${pedal.enabled ? 'on' : 'off'}${pedal.bypassed ? ', bypassed' : ''}`}
        onClick={() => onToggle(pedal.id)}
      >
        <EffectBlockSvg pedal={pedal} palette={palette} selected={selected} />
      </button>
      <button type="button" className="chain-effect-grip" aria-label={`Move ${pedal.name}`} {...attributes} {...listeners}>
        ≡
      </button>
    </div>
  );
}

type EffectBlockSvgProps = {
  pedal: Pedal;
  palette: { color: string; bg: string };
  selected: boolean;
};

function EffectBlockSvg({ pedal, palette, selected }: EffectBlockSvgProps) {
  const safeId = pedal.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `effectBlockGradient-${safeId}`;
  const glowId = `effectBlockGlow-${safeId}`;
  const iconPath = effectIconPaths[pedal.type];
  const name = truncateLabel(pedal.name.toUpperCase(), 13);
  const status = pedal.enabled ? (pedal.bypassed ? 'BYPASS' : 'ACTIVE') : 'OFF';
  const ledColor = pedal.enabled && !pedal.bypassed ? palette.color : '#53615d';

  return (
    <svg className="chain-effect-svg" viewBox="0 0 180 140" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={palette.color} stopOpacity="0.34" />
          <stop offset="0.42" stopColor="#152228" stopOpacity="0.96" />
          <stop offset="1" stopColor="#070b0e" stopOpacity="1" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect className="effect-svg-shadow" x="10" y="10" width="160" height="120" rx="14" />
      <rect
        className="effect-svg-body"
        x="14"
        y="9"
        width="152"
        height="118"
        rx="13"
        fill={`url(#${gradientId})`}
        stroke={palette.color}
      />
      <path className="effect-svg-top-shine" d="M28 18H153C157 18 160 21 160 25V43C122 34 74 35 20 44V26C20 21 24 18 28 18Z" />
      <rect className="effect-svg-display" x="27" y="48" width="126" height="46" rx="7" />
      <path className="effect-svg-grid" d="M43 48V94M59 48V94M75 48V94M91 48V94M107 48V94M123 48V94M139 48V94M27 63H153M27 78H153" />
      <path className="effect-svg-icon" d={iconPath} stroke={palette.color} filter={`url(#${glowId})`} />
      <circle className="effect-svg-led-halo" cx="47" cy="111" r="15" fill={ledColor} />
      <circle className="effect-svg-led" cx="47" cy="111" r="7" fill={ledColor} />
      <rect className="effect-svg-chip" x="122" y="101" width="26" height="19" rx="4" />
      <path className="effect-svg-chip-lines" d="M128 106H142M128 111H142M128 116H137" />

      <text className="effect-svg-short-label" x="30" y="35">
        {shortLabels[pedal.type]}
      </text>
      <text className="effect-svg-name" x="90" y="72" textAnchor="middle">
        {name}
      </text>
      <text className="effect-svg-status" x="90" y="88" textAnchor="middle">
        {status}
      </text>
      {selected ? <rect className="effect-svg-selected" x="7" y="5" width="166" height="128" rx="17" /> : null}
    </svg>
  );
}

const truncateLabel = (label: string, maxLength: number) => (label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label);

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

const effectIconPaths: Record<PedalType, string> = {
  tuner: 'M45 73H67L79 59L91 88L103 64L113 73H135',
  noiseGate: 'M45 74C58 74 56 58 70 58C86 58 80 90 96 90C111 90 107 66 135 66',
  compressor: 'M45 62H69L80 78L91 62H114L135 78',
  drive: 'M44 80C61 50 75 94 91 64C108 34 117 86 136 56',
  ampEQ: 'M43 79C58 78 63 62 78 66C94 70 92 82 108 79C123 76 123 55 137 58',
  cabinetIR: 'M48 86V56H132V86M62 86V67M78 86V67M94 86V67M110 86V67M126 86V67',
  modulation: 'M43 74C51 51 65 51 73 74C81 97 95 97 103 74C111 51 125 51 137 74',
  delay: 'M50 81C67 61 81 61 96 81C110 101 124 101 139 81M57 58H128',
  reverb: 'M45 84C62 54 84 54 96 78C106 99 126 98 137 67M51 58C66 45 82 46 94 62',
  looper: 'M57 70C57 54 70 43 88 43H103M103 43L94 34M103 43L94 52M123 70C123 86 110 97 92 97H77M77 97L86 88M77 97L86 106',
  rhythm: 'M52 90V52M72 90V62M92 90V46M112 90V66M132 90V55',
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
