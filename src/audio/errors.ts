// Engine errors carry a code; the user-facing text lives in src/i18n/ko.ts ('error.<code>').
export type AudioEngineErrorCode =
  | 'engineNotReady'
  | 'contextClosed'
  | 'outputNotSupported'
  | 'connectionCancelled'
  | 'rebuildFailed'
  | 'unsupportedBrowser';

export class AudioEngineError extends Error {
  constructor(
    readonly code: AudioEngineErrorCode,
    readonly cause?: unknown,
  ) {
    super(code);
    // A cancelled connection keeps the AbortError name the operation-generation checks rely on.
    this.name = code === 'connectionCancelled' ? 'AbortError' : 'AudioEngineError';
  }
}

export const cancelled = () => new AudioEngineError('connectionCancelled');
