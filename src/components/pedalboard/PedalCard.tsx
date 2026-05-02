import { Pedal, PedalParamValue } from '../../audio/types';
import AmpEQPedal from '../effects/AmpEQPedal';
import CabinetIRPedal from '../effects/CabinetIRPedal';
import CompressorPedal from '../effects/CompressorPedal';
import DrivePedal from '../effects/DrivePedal';

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

function PedalCard({
  pedal,
  selected,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onSelect,
  onToggle,
  onBypass,
  onParamChange,
}: PedalCardProps) {
  if (pedal.type === 'cabinetIR') {
    return (
      <CabinetIRPedal
        pedal={pedal}
        selected={selected}
        dragAttributes={dragAttributes}
        dragListeners={dragListeners}
        isDragging={isDragging}
        onSelect={onSelect}
        onToggle={onToggle}
        onBypass={onBypass}
        onParamChange={onParamChange}
      />
    );
  }

  if (pedal.type === 'ampEQ') {
    return (
      <AmpEQPedal
        pedal={pedal}
        selected={selected}
        dragAttributes={dragAttributes}
        dragListeners={dragListeners}
        isDragging={isDragging}
        onSelect={onSelect}
        onToggle={onToggle}
        onBypass={onBypass}
        onParamChange={onParamChange}
      />
    );
  }

  if (pedal.type === 'compressor') {
    return (
      <CompressorPedal
        pedal={pedal}
        selected={selected}
        dragAttributes={dragAttributes}
        dragListeners={dragListeners}
        isDragging={isDragging}
        onSelect={onSelect}
        onToggle={onToggle}
        onBypass={onBypass}
        onParamChange={onParamChange}
      />
    );
  }

  if (pedal.type === 'drive') {
    return (
      <DrivePedal
        pedal={pedal}
        selected={selected}
        dragAttributes={dragAttributes}
        dragListeners={dragListeners}
        isDragging={isDragging}
        onSelect={onSelect}
        onToggle={onToggle}
        onBypass={onBypass}
        onParamChange={onParamChange}
      />
    );
  }

  return (
    <article
      className={`pedal-card ${selected ? 'is-selected' : ''} ${pedal.enabled ? 'is-on' : 'is-off'} ${
        isDragging ? 'is-dragging' : ''
      }`}
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
        <button type="button" className="pedal-select" onClick={() => onSelect(pedal.id)}>
          <span>{pedal.type}</span>
          <strong>{pedal.name}</strong>
        </button>
      </div>

      <div className="pedal-switches">
        <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={() => onToggle(pedal.id)}>
          {pedal.enabled ? 'On' : 'Off'}
        </button>
        <button
          type="button"
          className={pedal.bypassed ? 'is-bypassed' : ''}
          onClick={() => onBypass(pedal.id, !pedal.bypassed)}
        >
          {pedal.bypassed ? 'Bypassed' : 'Bypass'}
        </button>
      </div>

      <div className="pedal-params">
        {Object.entries(pedal.params).map(([paramName, value]) => (
          <label key={paramName}>
            <span>{formatParamName(paramName)}</span>
            <ParamInput
              value={value}
              onChange={(nextValue) => onParamChange(pedal.id, paramName, nextValue)}
            />
          </label>
        ))}
      </div>
    </article>
  );
}

type ParamInputProps = {
  value: PedalParamValue;
  onChange: (value: PedalParamValue) => void;
};

function ParamInput({ value, onChange }: ParamInputProps) {
  if (typeof value === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        aria-label="Boolean parameter"
      />
    );
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        step={Math.abs(value) > 10 ? 1 : 0.01}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  }

  return <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />;
}

const formatParamName = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Db', 'dB')
    .replace('Ms', 'ms')
    .replace('Hz', 'Hz');

export default PedalCard;
