// Turns any error from the audio path into a Korean message (design §3.7).
import { AudioEngineError } from '../audio/errors';
import { t } from '../i18n/ko';

export function toUserMessage(error: unknown): string {
  if (error instanceof AudioEngineError) return t(`error.${error.code}`);
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return t('error.permission');
    case 'NotFoundError':
      return t('error.noInputDevice');
    case 'NotReadableError':
      return t('error.deviceBusy');
    case 'OverconstrainedError':
      return t('error.deviceGone');
    case 'AbortError':
      return t('error.connectionCancelled');
    default:
      console.error(error);
      return t('error.unknown');
  }
}
