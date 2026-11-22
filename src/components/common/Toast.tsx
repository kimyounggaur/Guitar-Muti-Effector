import { useEffect, useState } from 'react';
import { t, type MessageKey } from '../../i18n/ko';
import '../../styles/components/toast.css';

// A small notice at the bottom of the screen for two seconds (design §3.7). No store and no dependency:
// showToast() tells the one ToastHost that App renders.
const TOAST_MS = 2000;
type Listener = (text: string) => void;
const listeners = new Set<Listener>();

export function showToast(key: MessageKey) {
  const text = t(key);
  for (const listener of listeners) listener(text);
}

function ToastHost() {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    const listener: Listener = (text) => setToast((current) => ({ text, id: (current?.id ?? 0) + 1 }));
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="app-toast-region" role="status" aria-live="polite">
      {toast ? <p key={toast.id} className="app-toast">{toast.text}</p> : null}
    </div>
  );
}

export default ToastHost;
