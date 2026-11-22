import { t } from '../i18n/ko';
import { useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import { hydrateFromSession, loadSession, migrateLegacyStorage, startSessionAutosave } from '../store/persistence';

/** Restores the saved session, keeps it saved, and explains a blocked storage in Korean. */
export function useSessionPersistence() {
  const setErrorMessage = useAudioStore((state) => state.setErrorMessage);

  useEffect(() => {
    const onStorageError = () => setErrorMessage(t('error.storage'));
    window.addEventListener('pedalboard-storage-error', onStorageError);
    return () => window.removeEventListener('pedalboard-storage-error', onStorageError);
  }, [setErrorMessage]);

  useEffect(() => {
    migrateLegacyStorage();
    hydrateFromSession(loadSession());
    return startSessionAutosave();
  }, []);
}
