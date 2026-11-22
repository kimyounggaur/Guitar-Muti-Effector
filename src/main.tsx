import './styles/tokens.css';
import './styles/globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AudioControllerProvider } from './app/AudioControllerContext';
// Phone layout (max-width: 600px). Loaded after every component style so it can rearrange them.
import './styles/mobile.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AudioControllerProvider>
      <App />
    </AudioControllerProvider>
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
