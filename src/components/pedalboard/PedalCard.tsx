import { Pedal, PedalParamValue, PedalType } from '../../audio/types';

type PedalCardProps = {
  pedal: Pedal;
  selected: boolean;
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  isDragging?: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onBypass: (id: string, bypassed: boolean) => void;
  onParamChange: (id: string, paramName: string, value: PedalParamValue) => void;
};

const typeLabels: Record<PedalType, string> = {
  tuner: 'Pitch',
  noiseGate: 'Gate',
  compressor: 'Dynamics',
  drive: 'Gain',
  ampEQ: 'Amp EQ',
  cabinetIR: 'Cab',
  modulation: 'Motion',
  delay: 'Echo',
  reverb: 'Space',
  looper: 'Loop',
  rhythm: 'Rhythm',
};

const primaryParams: Partial<Record<PedalType, string[]>> = {
  tuner: ['mode', 'referenceA4', 'sensitivity'],
  noiseGate: ['thresholdDb', 'releaseMs'],
  compressor: ['sustain', 'mix', 'level'],
  drive: ['mode', 'drive', 'tone', 'level'],
  ampEQ: ['bass', 'mid', 'treble', 'presence'],
  cabinetIR: ['cabinetType', 'lowCut', 'highCut', 'mix'],
  modulation: ['mode', 'rate', 'depth', 'mix'],
  delay: ['mode', 'timeMs', 'feedback', 'mix'],
  reverb: ['mode', 'decay', 'mix', 'level'],
  looper: ['level', 'overdubLevel', 'feedback'],
  rhythm: ['pattern', 'bpm', 'volume'],
};

function PedalCard({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
}: PedalCardProps) {
  const displayedParams = getDisplayedParams(pedal);

  return (
    <article
      className={`pedal-card compact-pedal type-${pedal.type} ${selected ? 'is-selected' : ''} ${
        pedal.enabled ? 'is-on' : 'is-off'
      } ${pedal.bypassed ? 'is-bypassed' : ''} ${isDragging ? 'is-dragging' : ''}`}
    >
      <div className="pedal-top">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Move ${pedal.name}`}
          {...dragAttributes}
          {...dragListeners}
        >
          ≡
        </button>
        <button type="button" className="pedal-select compact-display" onClick={() => onSelect(pedal.id)}>
          <span>{typeLabels[pedal.type] ?? 'Effect'}</span>
          <strong>{pedal.name}</strong>
          <em>{pedal.enabled ? (pedal.bypassed ? 'Bypass path' : 'Active path') : 'Muted block'}</em>
        </button>
      </div>

      <div className="pedal-led-row" aria-label={`${pedal.name} status`}>
        <button type="button" className={`touch-led ${pedal.enabled ? 'is-lit' : ''}`} onClick={() => onToggle(pedal.id)}>
          <i aria-hidden="true" />
          <span>{pedal.enabled ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          className={`touch-led ${pedal.bypassed ? 'is-warn' : 'is-lit'}`}
          onClick={() => onBypass(pedal.id, !pedal.bypassed)}
        >
          <i aria-hidden="true" />
          <span>{pedal.bypassed ? 'Bypass' : 'In Line'}</span>
        </button>
      </div>

      <div className="compact-param-grid">
        {displayedParams.map(([paramName, value]) => (
          <div key={paramName} className="compact-param">
            <span>{formatParamName(paramName)}</span>
            <strong>{formatParamValue(value)}</strong>
            {typeof value === 'number' ? <i style={{ width: `${getParamFill(paramName, value)}%` }} /> : null}
          </div>
        ))}
      </div>
    </article>
  );
}

const getDisplayedParams = (pedal: Pedal) => {
  const names = primaryParams[pedal.type] ?? Object.keys(pedal.params).slice(0, 4);
  return names
    .filter((name) => name in pedal.params)
    .slice(0, 5)
    .map((name) => [name, pedal.params[name]] as const);
};

const getParamFill = (name: string, value: number) => {
  const ranges: Record<string, [number, number]> = {
    thresholdDb: [-60, -10],
    releaseMs: [0, 500],
    attack: [0.001, 0.1],
    release: [0.05, 1],
    ratio: [1, 20],
    knee: [0, 40],
    drive: [0, 100],
    tone: [0, 100],
    level: [0, 100],
    mix: [0, 100],
    bass: [-12, 12],
    mid: [-12, 12],
    treble: [-12, 12],
    presence: [-12, 12],
    lowCut: [20, 500],
    highCut: [1000, 12000],
    timeMs: [20, 2000],
    feedback: [0, value <= 1 ? 0.95 : 100],
    decay: [0.2, 10],
    rate: [0.05, 20],
    depth: [0, 100],
    stereoWidth: [0, 100],
    bpm: [40, 240],
    volume: [0, 100],
    referenceA4: [430, 450],
    sensitivity: [0, 100],
    overdubLevel: [0, 100],
  };
  const [min, max] = ranges[name] ?? [0, 100];
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
};

const formatParamName = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Db', 'dB')
    .replace('Ms', 'ms')
    .replace('A4', 'A4')
    .replace('IR', 'IR');

const formatParamValue = (value: PedalParamValue) => {
  if (typeof value === 'boolean') {
    return value ? 'On' : 'Off';
  }

  if (typeof value === 'number') {
    if (Math.abs(value) < 10 && !Number.isInteger(value)) {
      return value.toFixed(2);
    }

    return Math.round(value).toString();
  }

  return String(value).replace(/([A-Z])/g, ' $1').replace(/^./, (firstLetter) => firstLetter.toUpperCase());
};

export default PedalCard;
