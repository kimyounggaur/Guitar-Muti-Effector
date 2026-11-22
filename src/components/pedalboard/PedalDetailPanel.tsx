import { useEffect, useMemo } from 'react';
import { scrollTargetRef } from '../../app/scrollTargets';
import { Pedal, PedalParamValue } from '../../audio/types';
import { usePedalStore } from '../../store/pedalStore';
import AmpEQPedal from '../effects/ampEQ/AmpEQPedal';
import CabinetIRPedal from '../effects/cabinetIR/CabinetIRPedal';
import DetailActions from '../effects/common/DetailActions';
import { GenericPedalDetail } from '../effects/common/GenericParamControls';
import CompressorRackPanel from '../effects/compressor/CompressorRackPanel';
import DriveRackPanel from '../effects/drive/DriveRackPanel';
import LooperPanel from '../effects/looper/LooperPanel';
import NoiseGateRackPanel from '../effects/noiseGate/NoiseGateRackPanel';
import RhythmPanel from '../effects/rhythm/RhythmPanel';
import TunerPanel from '../effects/tuner/TunerPanel';
import '../../styles/components/detail-panel.css';
import { t } from '../../i18n/ko';

type PedalDetailPanelProps = {
  onPedalToggled?: (pedals: Pedal[]) => void;
  onPedalBypassChanged?: (pedalId: string, bypassed: boolean) => void;
  onPedalParamChanged?: (pedalId: string, paramName: string, value: PedalParamValue) => void;
};

/** Picks the detail panel for the selected pedal. */
function PedalDetailPanel({ onPedalToggled, onPedalBypassChanged, onPedalParamChanged }: PedalDetailPanelProps) {
  const pedals = usePedalStore((state) => state.pedals);
  const selectedPedalId = usePedalStore((state) => state.selectedPedalId);
  const store = usePedalStore.getState();
  const setSelectedPedal = usePedalStore((state) => state.setSelectedPedal);
  const pedal = useMemo(() => pedals.find((item) => item.id === selectedPedalId) ?? pedals[0] ?? null, [pedals, selectedPedalId]);

  useEffect(() => {
    if (!selectedPedalId && pedals[0]) setSelectedPedal(pedals[0].id);
  }, [pedals, selectedPedalId, setSelectedPedal]);

  if (!pedal) {
    return (
      <section className="detail-section" aria-label={t('panel.detail.sectionRegion')}>
        <div className="detail-empty">{t('panel.detail.empty')}</div>
      </section>
    );
  }

  const rebuild = () => window.requestAnimationFrame(() => onPedalToggled?.(usePedalStore.getState().pedals));
  const handleToggle = () => { store.togglePedal(pedal.id); rebuild(); };
  const setBypass = (bypassed: boolean) => { store.setPedalBypass(pedal.id, bypassed); onPedalBypassChanged?.(pedal.id, bypassed); };
  const handleBypass = () => setBypass(!pedal.bypassed);
  const handleParamChange = (paramName: string, value: PedalParamValue) => {
    store.updatePedalParam(pedal.id, paramName, value);
    onPedalParamChanged?.(pedal.id, paramName, value);
  };
  const handleReset = () => {
    if (!window.confirm(t('confirm.resetAll'))) return;
    store.resetPedals();
    rebuild();
  };
  const card = {
    pedal,
    selected: true,
    onSelect: setSelectedPedal,
    onToggle: () => handleToggle(),
    onBypass: (_: string, bypassed: boolean) => setBypass(bypassed),
    onParamChange: (_: string, name: string, value: PedalParamValue) => handleParamChange(name, value),
  };
  const rack = { pedal, onToggle: handleToggle, onBypass: handleBypass, onParamChange: handleParamChange };
  const actions = (className: string, withTuner = true) => (
    <DetailActions className={className} onReset={handleReset} onTuner={withTuner ? () => setSelectedPedal('tuner') : undefined} />
  );

  switch (pedal.type) {
    case 'looper': {
      const onParamChange = (_: string, name: string, value: PedalParamValue) => {
        if (name === '__looperCommand') onPedalParamChanged?.(pedal.id, name, value);
        else handleParamChange(name, value);
      };
      return <section ref={scrollTargetRef('looper')} className="detail-section" aria-label={t('panel.detail.looperRegion')}><LooperPanel {...card} onParamChange={onParamChange} /></section>;
    }
    case 'cabinetIR':
      return <section className="detail-section" aria-label={t('panel.detail.cabinetRegion')}><CabinetIRPedal {...card} /></section>;
    case 'rhythm':
      return <section className="detail-section" aria-label={t('panel.detail.rhythmRegion')}><RhythmPanel {...card} /></section>;
    case 'ampEQ':
      return <section className="detail-section amp-eq-detail-section" aria-label={t('panel.detail.ampEqRegion')}><AmpEQPedal {...card} />{actions('amp-eq-detail-actions')}</section>;
    case 'tuner':
      return <section ref={scrollTargetRef('tuner')} className="detail-section tuner-detail-section" aria-label={t('panel.detail.tunerRegion')}><TunerPanel {...card} />{actions('tuner-detail-actions', false)}</section>;
    case 'noiseGate':
      return <section className="detail-section noise-gate-detail-section" aria-label={t('panel.detail.noiseGateRegion')}><NoiseGateRackPanel {...rack} />{actions('noise-gate-detail-actions')}</section>;
    case 'compressor':
      return <section className="detail-section compressor-detail-section" aria-label={t('panel.detail.compressorRegion')}><CompressorRackPanel {...rack} />{actions('compressor-detail-actions')}</section>;
    case 'drive':
      return <section className="detail-section drive-rack-detail-section" aria-label={t('panel.detail.driveRegion')}><DriveRackPanel {...rack} />{actions('drive-rack-detail-actions')}</section>;
    default:
      return <GenericPedalDetail {...rack} actions={actions('')} />;
  }
}

export default PedalDetailPanel;
