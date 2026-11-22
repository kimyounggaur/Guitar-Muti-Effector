import { useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import { hydrateFromSession, loadSession, migrateLegacyStorage, startSessionAutosave } from '../store/persistence';

/** Restores the saved session, keeps it saved, and explains a blocked storage in Korean. */
export function useSessionPersistence() {
  const setErrorMessage = useAudioStore((state) => state.setErrorMessage);

  useEffect(() => {
    const onStorageError = () => setErrorMessage('브라우저 저장 공간을 사용할 수 없습니다. 현재 설정은 새로고침하면 사라질 수 있습니다.');
    window.addEventListener('pedalboard-storage-error', onStorageError);
    return () => window.removeEventListener('pedalboard-storage-error', onStorageError);
  }, [setErrorMessage]);

  useEffect(() => {
    migrateLegacyStorage();
    hydrateFromSession(loadSession());
    return startSessionAutosave();
  }, []);
}
