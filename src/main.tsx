import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/hardware.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Cache only the built application assets. Audio and user presets stay in the browser.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
      // Offline installation must never interrupt audio or editing.
    });
  });
}
