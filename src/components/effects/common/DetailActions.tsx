import { saveSessionNow } from '../../../store/persistence';

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
        페달 설정 저장
      </button>
      <button type="button" onClick={onReset}>
        전체 초기화
      </button>
      {onTuner ? (
        <button type="button" onClick={onTuner}>
          튜너
        </button>
      ) : null}
    </div>
  );
}
