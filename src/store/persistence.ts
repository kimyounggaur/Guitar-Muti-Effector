// Single place for everything the app keeps in the browser (design §3.4).
// All access goes through safeStorage so blocked or full storage never interrupts playing.
import { normalizePedals, type InputChannel, type Pedal } from '../audio/types';
import { clampTempo } from '../audio/params/schema';
import { readLocal, removeLocal, writeLocal } from './safeStorage';
import { useAudioStore } from './audioStore';
import { usePedalStore } from './pedalStore';
import { isPresetRecord, migrateLegacyPresetList, normalizeUserPresetList, presetListFrom } from '../presets/migrate';
import type { PedalboardPreset } from '../presets/types';
import { usePresetStore } from './presetStore';
import { useTempoStore } from './tempoStore';

export const KEYS = { session: 'gme.session.v3', userPresets: 'gme.userPresets.v3' } as const;
export const LEGACY = {
  sessionV2: 'guitar-multi-effector-session-v2',
  pedalsV1: 'guitar-multi-effector-pedals-v1',
  presets: 'web-guitar-pedalboard-presets',
} as const;

export type SessionV3 = {
  version: 3;
  pedals: Pedal[];
  masterVolume: number;
  outputTrimDb: number;
  tempoBpm: number;
  activePresetId: string | null;
  inputChannel: InputChannel;
  /** Shown when the session is not tied to a preset (e.g. '이전 작업 설정'). */
  presetName?: string;
};

const AUTOSAVE_DELAY_MS = 300;
const SIZE_WARNING_BYTES = 50 * 1024;
const INPUT_CHANNELS: readonly InputChannel[] = ['1', '2', 'mix'] as const;

const parse = (raw: string | null): unknown => {
  if (raw === null) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finiteOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Older sessions kept the tempo inside pedal params. */
const legacyTempo = (pedals: unknown): number | null => {
  if (!Array.isArray(pedals)) return null;
  for (const pedal of pedals) {
    const bpm = isRecord(pedal) && isRecord(pedal.params) ? pedal.params.bpm : undefined;
    if (typeof bpm === 'number' && Number.isFinite(bpm)) return bpm;
  }
  return null;
};

const toSession = (value: unknown): SessionV3 | null => {
  if (!isRecord(value) || !Array.isArray(value.pedals)) return null;
  const tempo = typeof value.tempoBpm === 'number' && Number.isFinite(value.tempoBpm) ? value.tempoBpm : legacyTempo(value.pedals);
  const session: SessionV3 = {
    version: 3,
    pedals: normalizePedals(value.pedals),
    masterVolume: clamp(finiteOr(value.masterVolume, useAudioStore.getState().masterVolume), 0, 1),
    outputTrimDb: clamp(finiteOr(value.outputTrimDb, 0), -36, 0),
    tempoBpm: Math.round(clampTempo(tempo ?? undefined)),
    activePresetId: typeof value.activePresetId === 'string' ? value.activePresetId : null,
    inputChannel: INPUT_CHANNELS.includes(value.inputChannel as InputChannel) ? (value.inputChannel as InputChannel) : '1',
  };
  if (typeof value.presetName === 'string' && value.presetName) session.presetName = value.presetName.slice(0, 80);
  // A v2 session without outputTrimDb takes the trim of its preset when it is restored.
  if (typeof value.outputTrimDb !== 'number') return { ...session, outputTrimDb: Number.NaN };
  return session;
};

/** v2 supersedes the v1 pedal snapshot. Keep the raw value until the copy is verified. */
const readLegacySessions = () => {
  const v2 = readLocal(LEGACY.sessionV2);
  const v1 = readLocal(LEGACY.pedalsV1);
  const pedals = parse(v1);
  return [
    { key: LEGACY.sessionV2, raw: v2, session: toSession(parse(v2)) },
    { key: LEGACY.pedalsV1, raw: v1, session: Array.isArray(pedals)
      ? toSession({ pedals, activePresetId: null, outputTrimDb: 0, presetName: '이전 작업 설정' })
      : null },
  ];
};

/** Verify that storage returned the complete serialized copy before removing its source. */
const writeVerified = (key: string, value: unknown): boolean => {
  const json = JSON.stringify(value);
  if (!writeLocal(key, json)) return false;
  return readLocal(key) === json;
};

export function loadSession(): SessionV3 | null {
  return toSession(parse(readLocal(KEYS.session)))
    ?? readLegacySessions().find((source) => source.session)?.session
    ?? null;
}

export function loadUserPresets(): PedalboardPreset[] {
  const current = presetListFrom(parse(readLocal(KEYS.userPresets)));
  return current ? normalizeUserPresetList(current) : migrateLegacyPresetList(parse(readLocal(LEGACY.presets)));
}

export function saveUserPresets(presets: PedalboardPreset[]): boolean {
  const userPresets = presets.filter((preset) => preset.origin !== 'factory');
  return writeLocal(KEYS.userPresets, JSON.stringify({ version: 3, presets: userPresets }));
}

export function migrateLegacyStorage(): { migrated: string[]; kept: string[] } {
  const migrated: string[] = [];
  const kept: string[] = [];

  const finish = (key: string, raw: string, copied: boolean) => {
    // A malformed source, failed copy or newer edit in another tab must survive.
    if (copied && readLocal(key) === raw && removeLocal(key)) migrated.push(key);
    else kept.push(key);
  };

  if (readLocal(KEYS.session) === null) {
    const sources = readLegacySessions();
    const session = sources.find((source) => source.session)?.session;
    const copied = Boolean(session && writeVerified(KEYS.session, session));
    for (const source of sources) {
      if (source.raw !== null) finish(source.key, source.raw, copied && source.session !== null);
    }
  }

  if (readLocal(KEYS.userPresets) === null) {
    const raw = readLocal(LEGACY.presets);
    if (raw !== null) {
      const list = presetListFrom(parse(raw));
      const copied = list !== null && list.every(isPresetRecord)
        && writeVerified(KEYS.userPresets, { version: 3, presets: migrateLegacyPresetList(list) });
      finish(LEGACY.presets, raw, copied);
    }
  }

  return { migrated, kept };
}

/** Restore the saved session, or apply the first factory preset when there is none (F6). */
export function hydrateFromSession(session: SessionV3 | null) {
  const presetStore = usePresetStore.getState();
  presetStore.hydratePresets();
  const { presets } = usePresetStore.getState();

  if (!session) {
    const first = presets[0];
    if (first) {
      usePedalStore.getState().setPedals(first.pedals);
      useAudioStore.getState().setPresetTrimDb(first.outputTrimDb);
      useTempoStore.getState().setBpm(first.tempoBpm);
    }
    return;
  }

  const existing = presets.find((preset) => preset.id === session.activePresetId);
  usePedalStore.getState().setPedals(session.pedals);
  useAudioStore.getState().setMasterVolume(session.masterVolume);
  useAudioStore.getState().setPresetTrimDb(Number.isFinite(session.outputTrimDb) ? session.outputTrimDb : existing?.outputTrimDb ?? 0);
  useAudioStore.getState().setInputChannel(session.inputChannel);
  useTempoStore.getState().setBpm(session.tempoBpm);
  usePresetStore.getState().restoreSelection(existing?.id ?? null, existing?.name ?? session.presetName ?? '사용자 설정');
}

const currentSession = (): SessionV3 => {
  const audio = useAudioStore.getState();
  const preset = usePresetStore.getState();
  return {
    version: 3,
    pedals: usePedalStore.getState().pedals,
    masterVolume: audio.masterVolume,
    outputTrimDb: audio.presetTrimDb,
    tempoBpm: useTempoStore.getState().bpm,
    activePresetId: preset.activePresetId,
    inputChannel: audio.inputChannel,
    ...(preset.activePresetId ? {} : { presetName: preset.currentPresetName }),
  };
};

/** Save the current session right away (e.g. the "페달 설정 저장" buttons). */
export function saveSessionNow(): boolean {
  const json = JSON.stringify(currentSession());
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > SIZE_WARNING_BYTES) console.warn(`Saved session is ${Math.round(bytes / 1024)} KB (over 50 KB).`);
  return writeLocal(KEYS.session, json);
}

export function startSessionAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      saveSessionNow();
    }, AUTOSAVE_DELAY_MS);
  };
  saveSessionNow();
  const unsubscribers = [
    usePedalStore.subscribe((state, previous) => { if (state.pedals !== previous.pedals) schedule(); }),
    useAudioStore.subscribe((state, previous) => {
      if (state.masterVolume !== previous.masterVolume || state.presetTrimDb !== previous.presetTrimDb || state.inputChannel !== previous.inputChannel) schedule();
    }),
    useTempoStore.subscribe((state, previous) => { if (state.bpm !== previous.bpm) schedule(); }),
    usePresetStore.subscribe((state, previous) => {
      if (state.activePresetId !== previous.activePresetId || state.currentPresetName !== previous.currentPresetName) schedule();
    }),
  ];
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
