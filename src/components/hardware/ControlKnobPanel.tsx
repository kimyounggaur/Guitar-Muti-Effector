import { Pedal, PedalParamValue, PedalType } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';
import { useTempoStore } from '../../store/tempoStore';
import KnobControl from '../controls/KnobControl';

type ControlKnobPanelProps = {
  selectedPedal: Pedal | null;
  onPedalParamChanged?: (pedalId: string, paramName: string, value: PedalParamValue) => void;
};

type ControlConfig = {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

function ControlKnobPanel({ selectedPedal, onPedalParamChanged }: ControlKnobPanelProps) {
  const updatePedalParam = usePedalStore((state) => state.updatePedalParam);
  const controls = selectedPedal ? getControls(selectedPedal) : [];

  const handleChange = (control: ControlConfig, value: number) => {
    if (!selectedPedal) {
      return;
    }

    const nextValue = control.name === 'bpm' ? useTempoStore.getState().setBpm(value) : value;
    updatePedalParam(selectedPedal.id, control.name, nextValue);
    onPedalParamChanged?.(selectedPedal.id, control.name, nextValue);
  };

  return (
    <section className="control-knob-panel" aria-label="Selected effect parameters">
      {Array.from({ length: 4 }).map((_, index) => {
        const control = controls[index];
        const value = selectedPedal && control ? selectedPedal.params[control.name] : null;

        if (!control || typeof value !== 'number') {
          return (
            <div key={`empty-${index}`} className="hardware-knob-empty">
              <span>PARAM {index + 1}</span>
              <strong>--</strong>
            </div>
          );
        }

        return (
          <KnobControl
            key={control.name}
            className="hardware-knob-control"
            label={control.label}
            value={value}
            min={control.min}
            max={control.max}
            step={control.step}
            suffix={control.suffix ?? ''}
            onChange={(nextValue) => handleChange(control, nextValue)}
          />
        );
      })}
    </section>
  );
}

const controlMap: Partial<Record<PedalType, ControlConfig[]>> = {
  tuner: [
    { name: 'referenceA4', label: 'A4', min: 430, max: 450, step: 1, suffix: 'Hz' },
    { name: 'sensitivity', label: 'Sense', min: 0, max: 100, step: 1 },
    { name: 'smoothing', label: 'Smooth', min: 0, max: 100, step: 1 },
  ],
  noiseGate: [
    { name: 'thresholdDb', label: 'Thresh', min: -60, max: -10, step: 1, suffix: 'dB' },
    { name: 'releaseMs', label: 'Release', min: 20, max: 500, step: 5, suffix: 'ms' },
  ],
  compressor: [
    { name: 'sustain', label: 'Sustain', min: 0, max: 100, step: 1 },
    { name: 'attack', label: 'Attack', min: 0.001, max: 0.1, step: 0.001, suffix: 's' },
    { name: 'release', label: 'Release', min: 0.05, max: 1, step: 0.01, suffix: 's' },
    { name: 'mix', label: 'Mix', min: 0, max: 100, step: 1 },
  ],
  drive: [
    { name: 'drive', label: 'Drive', min: 0, max: 100, step: 1 },
    { name: 'tone', label: 'Tone', min: 0, max: 100, step: 1 },
    { name: 'level', label: 'Level', min: 0, max: 100, step: 1 },
    { name: 'mix', label: 'Mix', min: 0, max: 100, step: 1 },
  ],
  ampEQ: [
    { name: 'bass', label: 'Bass', min: -12, max: 12, step: 0.5, suffix: 'dB' },
    { name: 'mid', label: 'Mid', min: -12, max: 12, step: 0.5, suffix: 'dB' },
    { name: 'treble', label: 'Treble', min: -12, max: 12, step: 0.5, suffix: 'dB' },
    { name: 'presence', label: 'Presence', min: -12, max: 12, step: 0.5, suffix: 'dB' },
  ],
  cabinetIR: [
    { name: 'lowCut', label: 'Low Cut', min: 40, max: 200, step: 1, suffix: 'Hz' },
    { name: 'highCut', label: 'High Cut', min: 3000, max: 12000, step: 100, suffix: 'Hz' },
    { name: 'mix', label: 'Mix', min: 0, max: 100, step: 1 },
    { name: 'level', label: 'Level', min: 0, max: 100, step: 1 },
  ],
  modulation: [
    { name: 'rate', label: 'Rate', min: 0.05, max: 20, step: 0.05, suffix: 'Hz' },
    { name: 'depth', label: 'Depth', min: 0, max: 100, step: 1 },
    { name: 'mix', label: 'Mix', min: 0, max: 100, step: 1 },
    { name: 'stereoWidth', label: 'Width', min: 0, max: 100, step: 1 },
  ],
  delay: [
    { name: 'timeMs', label: 'Time', min: 20, max: 2000, step: 10, suffix: 'ms' },
    { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, step: 0.01 },
    { name: 'mix', label: 'Mix', min: 0, max: 100, step: 1 },
    { name: 'tone', label: 'Tone', min: 0, max: 100, step: 1 },
  ],
  reverb: [
    { name: 'decay', label: 'Decay', min: 0.2, max: 10, step: 0.1, suffix: 's' },
    { name: 'preDelay', label: 'Pre Delay', min: 0, max: 200, step: 1, suffix: 'ms' },
    { name: 'mix', label: 'Mix', min: 0, max: 100, step: 1 },
    { name: 'level', label: 'Level', min: 0, max: 100, step: 1 },
  ],
  looper: [
    { name: 'level', label: 'Level', min: 0, max: 100, step: 1 },
    { name: 'overdubLevel', label: 'Overdub', min: 0, max: 100, step: 1 },
    { name: 'feedback', label: 'Feedback', min: 0, max: 100, step: 1 },
  ],
  rhythm: [
    { name: 'bpm', label: 'BPM', min: 40, max: 240, step: 1 },
    { name: 'volume', label: 'Volume', min: 0, max: 100, step: 1 },
  ],
};

const getControls = (pedal: Pedal) => {
  const preferred = controlMap[pedal.type] ?? [];
  const fallback = Object.entries(pedal.params)
    .filter(([, value]) => typeof value === 'number')
    .map(([name]): ControlConfig => ({ name, label: formatLabel(name), min: 0, max: 100, step: 1 }));

  return [...preferred, ...fallback.filter((control) => !preferred.some((candidate) => candidate.name === control.name))]
    .filter((control) => typeof pedal.params[control.name] === 'number')
    .slice(0, 4);
};

const formatLabel = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Db', 'dB')
    .replace('Ms', 'ms');

export default ControlKnobPanel;
