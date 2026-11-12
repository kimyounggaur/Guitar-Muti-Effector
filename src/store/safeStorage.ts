/** Storage may be disabled or full. Playback and editing must keep working. */
export const readLocal = (key: string): string | null => {
  try { return window.localStorage.getItem(key); }
  catch { return null; }
};
export const writeLocal = (key: string, value: string): boolean => {
  try { window.localStorage.setItem(key, value); return true; }
  catch {
    window.dispatchEvent(new CustomEvent('pedalboard-storage-error'));
    return false;
  }
};
