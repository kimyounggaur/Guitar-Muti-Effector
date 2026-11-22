import { Pedal, PedalParamValue, PedalType } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';
import { useTempoStore } from '../../store/tempoStore';
import { getParamSpec, TEMPO } from '../../audio/params/schema';
import KnobControl from '../controls/KnobControl';
import { t } from '../../i18n/ko';

type ControlKnobPanelProps = {
  selectedPedal: Pedal | null;
  onPedalParamChanged?: (pedalId: string, paramName: string, value: PedalParamValue) => void;
};

type ControlName = { name: string; label: string };

type ControlConfig = ControlName & {
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

/** The shared tempo is shown as a rhythm control but lives only in tempoStore. */
const TEMPO_CONTROL = 'bpm';

function ControlKnobPanel({ selectedPedal, onPedalParamChanged }: ControlKnobPanelProps) {
  const updatePedalParam = usePedalStore((state) => state.updatePedalParam);
  const tempoBpm = useTempoStore((state) => state.bpm);
  const setTempoBpm = useTempoStore((state) => state.setBpm);
  const controls = selectedPedal ? getControls(selectedPedal) : [];

  const handleChange = (control: ControlConfig, value: number) => {
    if (!selectedPedal) {
      return;
    }

    if (control.name === TEMPO_CONTROL) {
      setTempoBpm(value);
      return;
    }

    updatePedalParam(selectedPedal.id, control.name, value);
    onPedalParamChanged?.(selectedPedal.id, control.name, value);
  };

  return (
    <section className="control-knob-panel" aria-label={t('panel.knobs.region')}>
      {Array.from({ length: 4 }).map((_, index) => {
        const control = controls[index];
        const value = !selectedPedal || !control ? null : control.name === TEMPO_CONTROL ? tempoBpm : selectedPedal.params[control.name];

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

const controlMap: Partial<Record<PedalType, ControlName[]>> = {
  tuner: [
    { name: 'referenceA4', label: 'A4' },
    { name: 'sensitivity', label: 'Sense' },
    { name: 'smoothing', label: 'Smooth' },
  ],
  noiseGate: [
    { name: 'thresholdDb', label: 'Thresh' },
    { name: 'releaseMs', label: 'Release' },
  ],
  compressor: [
    { name: 'sustain', label: 'Sustain' },
    { name: 'attack', label: 'Attack' },
    { name: 'release', label: 'Release' },
    { name: 'mix', label: 'Mix' },
  ],
  drive: [
    { name: 'drive', label: 'Drive' },
    { name: 'tone', label: 'Tone' },
    { name: 'level', label: 'Level' },
    { name: 'mix', label: 'Mix' },
  ],
  ampEQ: [
    { name: 'bass', label: 'Bass' },
    { name: 'mid', label: 'Mid' },
    { name: 'treble', label: 'Treble' },
    { name: 'presence', label: 'Presence' },
  ],
  cabinetIR: [
    { name: 'lowCut', label: 'Low Cut' },
    { name: 'highCut', label: 'High Cut' },
    { name: 'mix', label: 'Mix' },
    { name: 'level', label: 'Level' },
  ],
  modulation: [
    { name: 'rate', label: 'Rate' },
    { name: 'depth', label: 'Depth' },
    { name: 'mix', label: 'Mix' },
    { name: 'stereoWidth', label: 'Width' },
  ],
  delay: [
    { name: 'timeMs', label: 'Time' },
    { name: 'feedback', label: 'Feedback' },
    { name: 'mix', label: 'Mix' },
    { name: 'tone', label: 'Tone' },
  ],
  reverb: [
    { name: 'decay', label: 'Decay' },
    { name: 'preDelay', label: 'Pre Delay' },
    { name: 'mix', label: 'Mix' },
    { name: 'level', label: 'Level' },
  ],
  looper: [
    { name: 'level', label: 'Level' },
    { name: 'overdubLevel', label: 'Overdub' },
    { name: 'feedback', label: 'Feedback' },
  ],
  rhythm: [
    { name: 'bpm', label: 'BPM' },
    { name: 'volume', label: 'Volume' },
  ],
};

const toConfig = (type: PedalType, control: ControlName): ControlConfig => {
  if (control.name === TEMPO_CONTROL) return { ...control, min: TEMPO.min, max: TEMPO.max, step: 1 };
  const spec = getParamSpec(type, control.name);
  if (spec?.kind !== 'number') return { ...control, min: 0, max: 100, step: 1 };
  const suffix = spec.unit && spec.unit !== '%' ? spec.unit : undefined;
  return { ...control, min: spec.min, max: Math.min(spec.max, spec.safetyMax ?? Infinity), step: spec.uiStep ?? spec.step, suffix };
};

const getControls = (pedal: Pedal): ControlConfig[] => {
  const preferred = controlMap[pedal.type] ?? [];
  const fallback = Object.entries(pedal.params)
    .filter(([name, value]) => typeof value === 'number' && !name.startsWith('__'))
    .map(([name]): ControlName => ({ name, label: formatLabel(name) }));

  return [...preferred, ...fallback.filter((control) => !preferred.some((candidate) => candidate.name === control.name))]
    .filter((control) => control.name === TEMPO_CONTROL || typeof pedal.params[control.name] === 'number')
    .slice(0, 4)
    .map((control) => toConfig(pedal.type, control));
};

const formatLabel = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (firstLetter) => firstLetter.toUpperCase())
    .replace('Db', 'dB')
    .replace('Ms', 'ms');

export default ControlKnobPanel;
