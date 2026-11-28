import type { ReactNode } from 'react';
import { scrollTargetRef } from '../../app/scrollTargets';
import { Pedal, PedalParamValue } from '../../audio/types';
import PatchHeader from './PatchHeader';
import { formatParamName } from '../effects/common/paramFormat';
import '../../styles/components/lcd.css';
import { t } from '../../i18n/ko';

type CentralScreenProps = {
  patchName: string;
  bank: string;
  patch: string;
  bpm: number;
  isAudioReady: boolean;
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
  selectedPedal,
  effectChain,
  presetBrowser,
}: CentralScreenProps) {
  const isBrowsingPresets = Boolean(presetBrowser);

  return (
    <section ref={scrollTargetRef('board')} className="central-screen" aria-label={t('panel.lcd.region')}>
      <div className="screen-bezel">
        <div className={`screen-glass ${isBrowsingPresets ? 'is-preset-browser' : ''}`}>
          <PatchHeader
            bank={bank}
            patch={patch}
            patchName={patchName}
            bpm={bpm}
            isAudioReady={isAudioReady}
          />
          <div className="screen-chain-window">{presetBrowser ?? effectChain}</div>
          {!isBrowsingPresets ? (
            <div className="screen-param-strip">
              {selectedPedal ? (
                getPedalSummary(selectedPedal).map(([name, value]) => (
                  <div key={name} className="screen-param-cell">
                    <span>{formatParamName(name, selectedPedal.type)}</span>
                    <strong>{formatParamValue(value)}</strong>
                  </div>
                ))
              ) : (
                <div className="screen-param-cell is-empty">
                  <span>{t('panel.lcd.selectedPedal')}</span>
                  <strong>{t('panel.common.none')}</strong>
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
  rhythm: ['pattern', 'volume', 'playing'],
};

const getPedalSummary = (pedal: Pedal) => {
  const names = summaryParams[pedal.type] ?? Object.keys(pedal.params);
  return names
    .filter((name) => name in pedal.params)
    .slice(0, 4)
    .map((name) => [name, pedal.params[name]] as const);
};

const formatParamValue = (value: PedalParamValue) => {
  if (typeof value === 'boolean') {
    return value ? t('panel.common.on') : t('panel.common.off');
  }

  if (typeof value === 'number') {
    return Math.abs(value) < 10 && !Number.isInteger(value) ? value.toFixed(2) : Math.round(value).toString();
  }

  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (firstLetter) => firstLetter.toUpperCase());
};

export default CentralScreen;
