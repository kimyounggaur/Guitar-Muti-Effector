import { saveSessionNow } from '../../../store/persistence';
import { t } from '../../../i18n/ko';

type DetailActionsProps = {
  className?: string;
  onReset: () => void;
  /** Omitted on the tuner panel itself. */
  onTuner?: () => void;
};

/** Save / reset / tuner buttons under every detail panel. */
export default function DetailActions({ className = '', onReset, onTuner }: DetailActionsProps) {
  return (
    <div className={`detail-actions${className ? ` ${className}` : ''}`}>
      <button type="button" onClick={saveSessionNow}>
        
        {t('panel.detail.save')}
      </button>
      <button type="button" onClick={onReset}>
        
        {t('panel.detail.resetAll')}
      </button>
      {onTuner ? (
        <button type="button" onClick={onTuner}>
          
          {t('pedal.tuner.name')}
        </button>
      ) : null}
    </div>
  );
}
