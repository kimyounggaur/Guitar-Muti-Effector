import type { ReactNode } from 'react';
import { getParamSpec } from '../../../audio/params/schema';
import type { Pedal, PedalParamValue, PedalType } from '../../../audio/types';
import KnobControl from '../../controls/KnobControl';
import { formatParamName, formatPedalType } from './paramFormat';
import { t } from '../../../i18n/ko';

type NumberRange = {
  min: number;
  max: number;
  step: number;
  suffix?: string;
};

const selectOptions: Partial<Record<PedalType, Record<string, Array<[string, string]>>>> = {
  tuner: {
    mode: [
      ['chromatic', '크로매틱'],
      ['guitar', '기타'],
      ['bass', '베이스'],
      ['ukulele', '우쿨렐레'],
    ],
  },
  drive: {
    mode: [
      ['overdrive', '오버드라이브'],
      ['crunch', '크런치'],
      ['distortion', '디스토션'],
      ['fuzz', '퍼즈'],
    ],
  },
  cabinetIR: {
    cabinetType: [
      ['1x12', '1x12'],
      ['2x12', '2x12'],
      ['4x12', '4x12'],
      ['openBack', '오픈 백'],
      ['custom', '사용자 IR'],
    ],
    mic: [
      ['dynamic', '다이내믹'],
      ['ribbon', '리본'],
      ['condenser', '콘덴서'],
      ['mixed', '혼합'],
    ],
  },
  modulation: {
    mode: [
      ['chorus', '코러스'],
      ['flanger', '플랜저'],
      ['phaser', '페이저'],
      ['tremolo', '트레몰로'],
      ['vibrato', '비브라토'],
    ],
    division: [
      ['1/1', '1/1'],
      ['1/2', '1/2'],
      ['1/4', '1/4'],
      ['1/8', '1/8'],
      ['dotted1/8', '점8분 (1/8.)'],
      ['1/16', '1/16'],
    ],
  },
  delay: {
    mode: [
      ['digital', '디지털'],
      ['analog', '아날로그'],
      ['tape', '테이프'],
      ['slapback', '슬랩백'],
      ['pingpong', '핑퐁'],
    ],
    division: [
      ['1/4', '1/4'],
      ['1/8', '1/8'],
      ['dotted1/8', '점8분 (1/8.)'],
      ['1/16', '1/16'],
    ],
  },
  reverb: {
    mode: [
      ['room', '룸 · 합성'],
      ['hall', '홀 · 합성'],
      ['plate', '플레이트 · 합성'],
      ['spring', '스프링 · 합성'],
      ['ambient', '앰비언트 · 합성'],
    ],
  },
  looper: {
    quantize: [
      ['off', '끔'],
      ['1bar', '1마디'],
      ['2bar', '2마디'],
      ['4bar', '4마디'],
    ],
  },
  rhythm: {
    pattern: [
      ['metronome', '메트로놈 4/4'],
      ['rock1', '록 1'],
      ['rock2', '록 2'],
      ['bluesShuffle', '블루스 셔플'],
      ['funk', '펑크'],
      ['ballad', '발라드'],
      ['sixEight', '6/8'],
      ['pop', '팝'],
    ],
  },
};


type DetailControlProps = {
  pedal: Pedal;
  paramName: string;
  value: PedalParamValue;
  onChange: (value: PedalParamValue) => void;
};

export function DetailControl({ pedal, paramName, value, onChange }: DetailControlProps) {
  const options = typeof value === 'string' ? selectOptions[pedal.type]?.[paramName] : null;

  if (typeof value === 'boolean') {
    return (
      <label className="detail-toggle">
        <span>{formatParamName(paramName, pedal.type)}</span>
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (typeof value === 'number') {
    const range = getNumberRange(pedal.type, paramName);
    return (
      <KnobControl
        className="detail-control"
        label={formatParamName(paramName, pedal.type)}
        value={value}
        min={range.min}
        max={range.max}
        step={range.step}
        suffix={range.suffix ?? ''}
        onChange={onChange}
      />
    );
  }

  if (options) {
    return (
      <label className="detail-select">
        <span>{formatParamName(paramName, pedal.type)}</span>
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
      <span>{formatParamName(paramName, pedal.type)}</span>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function MiniGraph({ pedal }: { pedal: Pedal }) {
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

const getNumberRange = (type: PedalType, name: string): NumberRange => {
  const spec = getParamSpec(type, name);
  if (spec?.kind === 'number') {
    const max = Math.min(spec.max, spec.safetyMax ?? Infinity);
    const suffix = spec.unit && spec.unit !== '%' ? spec.unit : undefined;
    return { min: spec.min, max, step: spec.uiStep ?? spec.step, suffix };
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

type GenericPedalDetailProps = {
  pedal: Pedal;
  onToggle: () => void;
  onBypass: () => void;
  onParamChange: (paramName: string, value: PedalParamValue) => void;
  actions: ReactNode;
};

/** Detail view for pedals without a dedicated rack panel (modulation, delay, reverb). */
export function GenericPedalDetail({ pedal, onToggle, onBypass, onParamChange, actions }: GenericPedalDetailProps) {
  const controls = Object.entries(pedal.params ?? {}).filter(([name]) => !name.startsWith('__'));
  return (
    <section className="detail-section" aria-label={t('panel.detail.region')}>
      <div className="detail-header">
        <div>
          <span className="eyebrow">{t('panel.detail.title')}</span>
          <h2>{pedal.name}</h2>
          <p>
            {formatPedalType(pedal.type)} · {pedal.enabled ? t('panel.common.on') : t('panel.common.off')} ·{' '}
            {pedal.bypassed ? t('panel.detail.bypassing') : t('panel.detail.processing')}
          </p>
        </div>
        <div className="detail-status">
          <button type="button" className={pedal.enabled ? 'is-active' : ''} onClick={onToggle}>
            {pedal.enabled ? t('panel.common.on') : t('panel.common.off')}
          </button>
          <button type="button" className={pedal.bypassed ? 'is-bypassed' : ''} onClick={onBypass}>
            {pedal.bypassed ? t('panel.common.unbypass') : t('panel.common.bypass')}
          </button>
        </div>
      </div>

      {pedal.type === 'reverb' ? (
        <p className="ir-source-note">
          <span className="ir-source-badge">{t('panel.common.synthetic')}</span>  {t('panel.detail.reverbSynthetic')}
        </p>
      ) : null}

      <div className="detail-body">
        <MiniGraph pedal={pedal} />
        <div className="detail-controls">
          {controls.map(([paramName, value]) => (
            <DetailControl
              key={paramName}
              pedal={pedal}
              paramName={paramName}
              value={value}
              onChange={(nextValue) => onParamChange(paramName, nextValue)}
            />
          ))}
        </div>
      </div>

      {actions}
    </section>
  );
}
