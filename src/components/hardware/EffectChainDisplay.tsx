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
  horizontalListSortingStrategy,
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
      <div className="tone-chain-stage">
        <span className="tone-chain-jack is-input" aria-hidden="true">
          <i />
          IN
        </span>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingPedal(null)}
        >
          <SortableContext items={pedalIds} strategy={horizontalListSortingStrategy}>
            <div className={`lcd-chain-rail tone-master-rail ${draggingPedalId ? 'is-dragging' : ''}`}>
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
        <span className="tone-chain-jack is-output" aria-hidden="true">
          OUT
          <i />
        </span>
      </div>
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

  if (pedal.type === 'ampEQ') {
    return (
      <svg className="chain-effect-svg tone-master-effect-svg is-amp-svg" viewBox="0 0 260 150" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#d7dde0" stopOpacity="0.96" />
            <stop offset="0.5" stopColor="#949a9d" stopOpacity="0.95" />
            <stop offset="1" stopColor="#5b6062" stopOpacity="1" />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect className="effect-svg-shadow" x="12" y="24" width="236" height="98" rx="7" />
        <rect className="effect-svg-body tone-amp-body" x="18" y="18" width="224" height="100" rx="6" fill={`url(#${gradientId})`} stroke={palette.color} />
        <rect className="tone-amp-grille" x="30" y="30" width="200" height="76" rx="3" />
        <path className="tone-amp-grille-lines" d="M38 36H222M38 44H222M38 52H222M38 60H222M38 68H222M38 76H222M38 84H222M38 92H222M38 100H222" />
        <path className="tone-amp-cloth" d="M44 34L216 104M74 34L230 98M104 34L230 82M134 34L230 66M164 34L226 58M34 58L148 106M34 74L118 106M34 90L88 106" />
        <rect className="tone-amp-top" x="38" y="21" width="184" height="13" rx="2" />
        <circle className="effect-svg-led-halo" cx="36" cy="126" r="13" fill={ledColor} />
        <circle className="effect-svg-led" cx="36" cy="126" r="5.8" fill={ledColor} />
        <text className="effect-svg-short-label" x="130" y="53" textAnchor="middle">
          AMP
        </text>
        <text className="effect-svg-name tone-amp-name" x="130" y="76" textAnchor="middle">
          {name}
        </text>
        <text className="effect-svg-status" x="130" y="96" textAnchor="middle">
          {status}
        </text>
        {selected ? <rect className="effect-svg-selected" x="8" y="8" width="244" height="124" rx="10" /> : null}
      </svg>
    );
  }

  return (
    <svg className="chain-effect-svg tone-master-effect-svg" viewBox="0 0 180 140" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={palette.color} stopOpacity="0.9" />
          <stop offset="0.48" stopColor={palette.color} stopOpacity="0.5" />
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

      <rect className="effect-svg-shadow" x="48" y="17" width="84" height="100" rx="6" />
      <rect
        className="effect-svg-body"
        x="52"
        y="13"
        width="76"
        height="100"
        rx="5"
        fill={`url(#${gradientId})`}
        stroke={palette.color}
      />
      <path className="effect-svg-top-shine" d="M60 20H120V36C101 31 82 31 60 37Z" />
      <rect className="effect-svg-display" x="62" y="43" width="56" height="34" rx="3" />
      <path className="effect-svg-grid" d="M73 43V77M84 43V77M96 43V77M107 43V77M62 54H118M62 66H118" />
      <path className="effect-svg-icon" d={iconPath} stroke={palette.color} filter={`url(#${glowId})`} />
      <circle className="effect-svg-led-halo" cx="70" cy="95" r="11" fill={ledColor} />
      <circle className="effect-svg-led" cx="70" cy="95" r="4.8" fill={ledColor} />
      <rect className="effect-svg-chip" x="96" y="88" width="19" height="15" rx="3" />
      <path className="effect-svg-chip-lines" d="M101 92H111M101 96H111M101 100H108" />

      <text className="effect-svg-short-label" x="90" y="29" textAnchor="middle">
        {shortLabels[pedal.type]}
      </text>
      <text className="effect-svg-name" x="90" y="126" textAnchor="middle">
        {name}
      </text>
      <text className="effect-svg-status" x="90" y="136" textAnchor="middle">
        {status}
      </text>
      {selected ? <rect className="effect-svg-selected" x="43" y="8" width="94" height="132" rx="8" /> : null}
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
