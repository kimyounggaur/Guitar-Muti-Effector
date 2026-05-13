import type { ReactNode } from 'react';
import { Pedal, PedalParamValue } from '../../audio/types';
import { MeterReading } from '../../audio/nodes/MeterNode';
import PatchHeader from './PatchHeader';

type CentralScreenProps = {
  patchName: string;
  bank: string;
  patch: string;
  bpm: number;
  isAudioReady: boolean;
  inputMeter: MeterReading;
  outputMeter: MeterReading;
  selectedPedal: Pedal | null;
  effectChain: ReactNode;
  presetBrowser?: ReactNode;
};

function CentralScreen({
  patchName,
  bank,
  patch,
  bpm,
  isAudioReady,
  inputMeter,
  outputMeter,
  selectedPedal,
  effectChain,
  presetBrowser,
}: CentralScreenProps) {
  const isBrowsingPresets = Boolean(presetBrowser);

  return (
    <section className="central-screen" aria-label="LCD touchscreen">
      <div className="screen-bezel">
        <div className={`screen-glass ${isBrowsingPresets ? 'is-preset-browser' : ''}`}>
          <PatchHeader
            bank={bank}
            patch={patch}
            patchName={patchName}
            bpm={bpm}
            isAudioReady={isAudioReady}
            inputMeter={inputMeter}
            outputMeter={outputMeter}
          />
          <div className="screen-chain-window">{presetBrowser ?? effectChain}</div>
          {!isBrowsingPresets ? (
            <div className="screen-param-strip">
              {selectedPedal ? (
                getPedalSummary(selectedPedal).map(([name, value]) => (
                  <div key={name} className="screen-param-cell">
                    <span>{formatParamName(name)}</span>
                    <strong>{formatParamValue(value)}</strong>
                  </div>
                ))
              ) : (
                <div className="screen-param-cell is-empty">
                  <span>Selected</span>
                  <strong>None</strong>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const summaryParams: Record<string, string[]> = {
  tuner: ['mode', 'referenceA4', 'sensitivity', 'smoothing'],
  noiseGate: ['thresholdDb', 'releaseMs'],
  compressor: ['sustain', 'attack', 'release', 'mix'],
  drive: ['mode', 'drive', 'tone', 'level'],
  ampEQ: ['bass', 'mid', 'treble', 'presence'],
  cabinetIR: ['cabinetType', 'lowCut', 'highCut', 'mix'],
  modulation: ['mode', 'rate', 'depth', 'mix'],
  delay: ['mode', 'timeMs', 'feedback', 'mix'],
  reverb: ['mode', 'decay', 'preDelay', 'mix'],
  looper: ['level', 'overdubLevel', 'feedback', 'quantize'],
  rhythm: ['pattern', 'bpm', 'volume', 'playing'],
};

const getPedalSummary = (pedal: Pedal) => {
  const names = summaryParams[pedal.type] ?? Object.keys(pedal.params);
  return names
    .filter((name) => name in pedal.params)
    .slice(0, 4)
    .map((name) => [name, pedal.params[name]] as const);
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
    return Math.abs(value) < 10 && !Number.isInteger(value) ? value.toFixed(2) : Math.round(value).toString();
  }

  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (firstLetter) => firstLetter.toUpperCase());
};

export default CentralScreen;
