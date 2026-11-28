import '../../src/styles/tokens.css';
import '../../src/styles/globals.css';
import { Profiler, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App';
import { AudioControllerProvider } from '../../src/app/AudioControllerContext';
import '../../src/styles/mobile.css';

// The Profiler counts actual commits. The DevTools hook attributes those commits to
// individual components, without adding instrumentation to the shipped application.
let commits = 0;
Object.assign(window, { readProfileCommits: () => commits });
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Profiler id="pedalboard" onRender={() => { commits++; }}>
      <AudioControllerProvider>
        <App />
      </AudioControllerProvider>
    </Profiler>
  </StrictMode>,
);
