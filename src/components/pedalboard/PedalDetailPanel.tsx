import { useEffect, useMemo } from 'react';
import { Pedal, PedalParamValue, PedalType } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';
import { useTempoStore } from '../../store/tempoStore';

type PedalDetailPanelProps = {
  onPedalToggled?: (pedals: Pedal[]) => void;
  onPedalBypassChanged?: (pedalId: string, bypassed: boolean) => void;
  onPedalParamChanged?: (pedalId: string, paramName: string, value: PedalParamValue) => void;
};

type NumberRange = {
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

const selectOptions: Partial<Record<PedalType, Record<string, Array<[string, string]>>>> = {
  tuner: {
    mode: [
      ['chromatic', 'Chromatic'],
      ['guitar', 'Guitar'],
      ['bass', 'Bass'],
      ['ukulele', 'Ukulele'],
    ],
  },
  drive: {
    mode: [
      ['overdrive', 'Overdrive'],
      ['crunch', 'Crunch'],
      ['distortion', 'Distortion'],
      ['fuzz', 'Fuzz'],
    ],
  },
  cabinetIR: {
    cabinetType: [
      ['1x12', '1x12'],
      ['2x12', '2x12'],
      ['4x12', '4x12'],
      ['openBack', 'Open Back'],
      ['custom', 'Custom'],
    ],
    mic: [
      ['dynamic', 'Dynamic'],
      ['ribbon', 'Ribbon'],
      ['condenser', 'Condenser'],
      ['mixed', 'Mixed'],
    ],
  },
  modulation: {
    mode: [
      ['chorus', 'Chorus'],
      ['flanger', 'Flanger'],
      ['phaser', 'Phaser'],
      ['tremolo', 'Tremolo'],
      ['vibrato', 'Vibrato'],
    ],
    division: [
      ['1/1', '1/1'],
      ['1/2', '1/2'],
      ['1/4', '1/4'],
      ['1/8', '1/8'],
      ['dotted1/8', 'Dotted 1/8'],
      ['1/16', '1/16'],
    ],
  },
  delay: {
    mode: [
      ['digital', 'Digital'],
      ['analog', 'Analog'],
      ['tape', 'Tape'],
      ['slapback', 'Slapback'],
      ['pingpong', 'Pingpong'],
    ],
    division: [
      ['1/4', '1/4'],
      ['1/8', '1/8'],
      ['dotted1/8', 'Dotted 1/8'],
      ['1/16', '1/16'],
    ],
  },
  reverb: {
    mode: [
      ['room', 'Room'],
      ['hall', 'Hall'],
      ['plate', 'Plate'],
      ['spring', 'Spring'],
      ['ambient', 'Ambient'],
    ],
  },
  looper: {
    quantize: [
      ['off', 'Off'],
      ['1bar', '1 Bar'],
      ['2bar', '2 Bars'],
      ['4bar', '4 Bars'],
    ],
  },
  rhythm: {
    pattern: [
      ['metronome', 'Metronome 4/4'],
      ['rock1', 'Rock 1'],
      ['rock2', 'Rock 2'],
      ['bluesShuffle', 'Blues Shuffle'],
      ['funk', 'Funk'],
      ['ballad', 'Ballad'],
      ['sixEight', '6/8'],
      ['pop', 'Pop'],
    ],
  },
};

function PedalDetailPanel({ onPedalToggled, onPedalBypassChanged, onPedalParamChanged }: PedalDetailPanelProps) {
  const pedals = usePedalStore((state) => state.pedals);
  const selectedPedalId = usePedalStore((state) => state.selectedPedalId);
  const togglePedal = usePedalStore((state) => state.togglePedal);
  const setPedalBypass = usePedalStore((state) => state.setPedalBypass);
  const updatePedalParam = usePedalStore((state) => state.updatePedalParam);
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const resetPedals = usePedalStore((state) => state.resetPedals);
  const savePedalsToStorage = usePedalStore((state) => state.savePedalsToStorage);
  const tempoBpm = useTempoStore((state) => state.bpm);
  const setTempoBpm = useTempoStore((state) => state.setBpm);
  const selectedPedal = useMemo(
    () => pedals.find((pedal) => pedal.id === selectedPedalId) ?? pedals[0] ?? null,
    [pedals, selectedPedalId],
  );

  useEffect(() => {
    if (!selectedPedalId && pedals[0]) {
      setSelectedPedal(pedals[0].id);
    }
  }, [pedals, selectedPedalId, setSelectedPedal]);

  if (!selectedPedal) {
    return (
      <section className="detail-section" aria-label="Pedal detail">
        <div className="detail-empty">Select a pedal to edit.</div>
      </section>
    );
  }

  const controls = Object.entries(selectedPedal.params).filter(([name]) => !name.startsWith('__'));

  const handleToggle = () => {
    togglePedal(selectedPedal.id);
    window.requestAnimationFrame(() => onPedalToggled?.(usePedalStore.getState().pedals));
  };

  const handleBypass = () => {
    const nextBypass = !selectedPedal.bypassed;
    setPedalBypass(selectedPedal.id, nextBypass);
    onPedalBypassChanged?.(selectedPedal.id, nextBypass);
  };

  const handleParamChange = (paramName: string, value: PedalParamValue) => {
    if (paramName === 'bpm' && typeof value === 'number') {
      setTempoBpm(value);
    }

    updatePedalParam(selectedPedal.id, paramName, value);
    onPedalParamChanged?.(selectedPedal.id, paramName, value);

    if (paramName === 'sync' && value === true) {
      updatePedalParam(selectedPedal.id, 'bpm', tempoBpm);
      onPedalParamChanged?.(selectedPedal.id, 'bpm', tempoBpm);
    }
  };

  const handleReset = () => {
    resetPedals();
    window.requestAnimationFrame(() => onPedalToggled?.(usePedalStore.getState().pedals));
  };

  return (
    <section className="detail-section" aria-label="Selected pedal detail">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Detail panel</span>
          <h2>{selectedPedal.name}</h2>
          <p>
            {formatPedalType(selectedPedal.type)} · {selectedPedal.enabled ? 'On' : 'Off'} ·{' '}
            {selectedPedal.bypassed ? 'Bypassed' : 'Signal in line'}
          </p>
        </div>
        <div className="detail-status">
          <button type="button" className={selectedPedal.enabled ? 'is-active' : ''} onClick={handleToggle}>
            {selectedPedal.enabled ? 'On' : 'Off'}
          </button>
          <button type="button" className={selectedPedal.bypassed ? 'is-bypassed' : ''} onClick={handleBypass}>
            {selectedPedal.bypassed ? 'Bypass' : 'In Line'}
          </button>
        </div>
      </div>

      <div className="detail-body">
        <MiniGraph pedal={selectedPedal} />
        <div className="detail-controls">
          {controls.map(([paramName, value]) => (
            <DetailControl
              key={paramName}
              pedal={selectedPedal}
              paramName={paramName}
              value={value}
              onChange={(nextValue) => handleParamChange(paramName, nextValue)}
            />
          ))}
        </div>
      </div>

      <div className="detail-actions">
        <button type="button" onClick={savePedalsToStorage}>
          Save Chain
        </button>
        <button type="button" onClick={handleReset}>
          Reset Board
        </button>
        <button type="button" onClick={() => setSelectedPedal('tuner')}>
          Tuner
        </button>
      </div>
    </section>
  );
}

type DetailControlProps = {
  pedal: Pedal;
  paramName: string;
  value: PedalParamValue;
  onChange: (value: PedalParamValue) => void;
};

function DetailControl({ pedal, paramName, value, onChange }: DetailControlProps) {
  const options = typeof value === 'string' ? selectOptions[pedal.type]?.[paramName] : null;

  if (typeof value === 'boolean') {
    return (
      <label className="detail-toggle">
        <span>{formatParamName(paramName)}</span>
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (typeof value === 'number') {
    const range = getNumberRange(pedal.type, paramName, value);
    return (
      <label className="detail-control">
        <span>{formatParamName(paramName)}</span>
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <strong>
          {formatNumber(value, range.step)}
          {range.suffix ?? ''}
        </strong>
      </label>
    );
  }

  if (options) {
    return (
      <label className="detail-select">
        <span>{formatParamName(paramName)}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="detail-select">
      <span>{formatParamName(paramName)}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function MiniGraph({ pedal }: { pedal: Pedal }) {
  return (
    <div className={`mini-graph type-${pedal.type}`} aria-hidden="true">
      <svg viewBox="0 0 320 128" role="img">
        <path className="graph-grid" d="M0 32H320M0 64H320M0 96H320M80 0V128M160 0V128M240 0V128" />
        <path className="graph-fill" d={`${getGraphPath(pedal.type)} L320 128 L0 128 Z`} />
        <path className="graph-line" d={getGraphPath(pedal.type)} />
      </svg>
      <span>{formatPedalType(pedal.type)}</span>
    </div>
  );
}

const getNumberRange = (type: PedalType, name: string, value: number): NumberRange => {
  if (name === 'threshold' || name === 'thresholdDb') {
    return { min: -60, max: -10, step: 1, suffix: 'dB' };
  }

  if (name === 'ratio') {
    return { min: 1, max: 20, step: 0.1 };
  }

  if (name === 'attack') {
    return { min: 0.001, max: 0.1, step: 0.001, suffix: 's' };
  }

  if (name === 'release') {
    return { min: 0.05, max: 1, step: 0.01, suffix: 's' };
  }

  if (name === 'knee') {
    return { min: 0, max: 40, step: 1, suffix: 'dB' };
  }

  if (name === 'bias') {
    return { min: -1, max: 1, step: 0.01 };
  }

  if (name === 'bass' || name === 'mid' || name === 'treble' || name === 'presence') {
    return { min: -12, max: 12, step: 0.5, suffix: 'dB' };
  }

  if (name === 'midFreq') {
    return { min: 250, max: 1500, step: 10, suffix: 'Hz' };
  }

  if (name === 'midQ') {
    return { min: 0.3, max: 4, step: 0.1 };
  }

  if (name === 'lowCut') {
    return { min: type === 'reverb' ? 20 : 40, max: type === 'reverb' ? 500 : 200, step: 1, suffix: 'Hz' };
  }

  if (name === 'highCut') {
    return { min: type === 'cabinetIR' ? 3000 : 1000, max: 12000, step: 100, suffix: 'Hz' };
  }

  if (name === 'timeMs') {
    return { min: 20, max: 2000, step: 10, suffix: 'ms' };
  }

  if (name === 'feedback') {
    return value <= 1 ? { min: 0, max: 0.95, step: 0.01 } : { min: 0, max: 100, step: 1 };
  }

  if (name === 'decay') {
    return { min: 0.2, max: 10, step: 0.1, suffix: 's' };
  }

  if (name === 'preDelay') {
    return { min: 0, max: 200, step: 1, suffix: 'ms' };
  }

  if (name === 'rate') {
    return { min: 0.05, max: 20, step: 0.05, suffix: 'Hz' };
  }

  if (name === 'bpm') {
    return { min: 40, max: 240, step: 1 };
  }

  if (name === 'referenceA4') {
    return { min: 430, max: 450, step: 1, suffix: 'Hz' };
  }

  if (name === 'releaseMs') {
    return { min: 20, max: 500, step: 5, suffix: 'ms' };
  }

  return { min: 0, max: 100, step: 1 };
};

const getGraphPath = (type: PedalType) => {
  if (type === 'drive' || type === 'compressor') {
    return 'M0 92 C44 94 68 74 98 70 C138 64 138 34 166 34 C210 34 204 72 244 72 C282 72 292 46 320 42';
  }

  if (type === 'delay' || type === 'reverb') {
    return 'M0 78 C34 50 54 50 78 78 C104 108 126 108 150 78 C174 50 196 50 220 78 C246 106 280 102 320 70';
  }

  if (type === 'modulation') {
    return 'M0 68 C28 24 56 24 82 68 C108 112 136 112 162 68 C188 24 216 24 242 68 C268 112 294 104 320 58';
  }

  if (type === 'ampEQ' || type === 'cabinetIR') {
    return 'M0 88 C48 84 54 56 96 58 C136 60 130 76 164 76 C202 76 206 42 248 42 C282 42 292 58 320 54';
  }

  if (type === 'rhythm' || type === 'looper') {
    return 'M0 98 L22 98 L24 34 L48 34 L50 98 L88 98 L90 58 L114 58 L116 98 L168 98 L170 40 L194 40 L196 98 L320 98';
  }

  return 'M0 80 C42 66 70 66 108 80 C150 96 180 96 216 80 C252 64 284 62 320 74';
};

const formatPedalType = (type: PedalType) =>
  type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Ir', 'IR')
    .replace('Eq', 'EQ');

const formatParamName = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Db', 'dB')
    .replace('Ms', 'ms')
    .replace('A4', 'A4')
    .replace('IR', 'IR');

const formatNumber = (value: number, step: number) => {
  if (step < 0.01) {
    return value.toFixed(3);
  }

  if (step < 1) {
    return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  }

  return Math.round(value).toString();
};

export default PedalDetailPanel;
