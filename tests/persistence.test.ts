// P4: every saved value goes through src/store/persistence.ts. No user data may be lost.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  data = new Map<string, string>();
  failWrites: 'none' | 'blocked' | 'quota' = 'none';
  getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
  setItem(key: string, value: string) {
    if (this.failWrites === 'blocked') throw new Error('blocked');
    if (this.failWrites === 'quota') { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error; }
    this.data.set(key, String(value));
  }
  removeItem(key: string) { this.data.delete(key); }
}

const storage = new MemoryStorage();
let storageErrors = 0;
(globalThis as any).CustomEvent = class { constructor(public type: string) {} };
(globalThis as any).window = {
  localStorage: storage,
  dispatchEvent(event: { type: string }) { if (event.type === 'pedalboard-storage-error') storageErrors++; return true; },
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0),
  setTimeout,
  clearTimeout,
};

const { KEYS, LEGACY, hydrateFromSession, loadSession, loadUserPresets, migrateLegacyStorage, saveSessionNow } = await import('../src/store/persistence');
const { usePedalStore } = await import('../src/store/pedalStore');
const { useAudioStore } = await import('../src/store/audioStore');
const { useTempoStore } = await import('../src/store/tempoStore');
const { usePresetStore } = await import('../src/store/presetStore');
const { createDefaultPedals } = await import('../src/audio/types');

beforeEach(() => {
  storage.data.clear();
  storage.failWrites = 'none';
  storageErrors = 0;
});

const customPedals = () => {
  const pedals = createDefaultPedals().reverse();
  const delay = pedals.find((pedal) => pedal.type === 'delay')!;
  delay.params.mix = 55;
  delay.params.bpm = 96; // older versions stored the tempo here
  return pedals;
};

test('a. blocked storage: the app keeps changing state and reports storage errors', () => {
  storage.failWrites = 'blocked';
  usePedalStore.getState().updatePedalParam('drive', 'drive', 77);
  assert.equal(usePedalStore.getState().pedals.find((pedal) => pedal.id === 'drive')?.params.drive, 77);
  assert.equal(saveSessionNow(), false);
  assert.ok(storageErrors >= 1);
});

test('b. full storage: old keys are kept', () => {
  storage.data.set(LEGACY.sessionV2, JSON.stringify({ pedals: customPedals(), masterVolume: 0.5, tempoBpm: 100, activePresetId: null }));
  storage.data.set(LEGACY.presets, JSON.stringify({ version: 3, presets: [] }));
  storage.failWrites = 'quota';
  const result = migrateLegacyStorage();
  assert.ok(storage.data.has(LEGACY.sessionV2));
  assert.ok(storage.data.has(LEGACY.presets));
  assert.deepEqual(result.migrated, []);
  assert.ok(result.kept.includes(LEGACY.sessionV2));
});

test('c. only v1 pedals: a v3 session keeps pedal order and values, and the v1 key goes', () => {
  const pedals = customPedals();
  storage.data.set(LEGACY.pedalsV1, JSON.stringify(pedals));
  migrateLegacyStorage();
  const session = loadSession();
  assert.ok(session);
  assert.equal(session.version, 3);
  assert.deepEqual(session.pedals.map((pedal) => pedal.id), pedals.map((pedal) => pedal.id));
  assert.equal(session.pedals.find((pedal) => pedal.type === 'delay')?.params.mix, 55);
  assert.equal(session.tempoBpm, 96);
  assert.equal(session.activePresetId, null);
  assert.equal(storage.data.has(LEGACY.pedalsV1), false);
  hydrateFromSession(session);
  assert.equal(usePresetStore.getState().currentPresetName, '이전 작업 설정');
});

test('d. only a v2 session: master, tempo and active preset survive, and the v2 key goes', () => {
  const activePresetId = usePresetStore.getState().presets[5].id;
  storage.data.set(LEGACY.sessionV2, JSON.stringify({ pedals: customPedals(), masterVolume: 0.42, outputTrimDb: -4, tempoBpm: 133, activePresetId }));
  migrateLegacyStorage();
  const session = loadSession();
  assert.ok(session);
  assert.equal(session.masterVolume, 0.42);
  assert.equal(session.tempoBpm, 133);
  assert.equal(session.activePresetId, activePresetId);
  assert.equal(storage.data.has(LEGACY.sessionV2), false);
  hydrateFromSession(session);
  assert.equal(useAudioStore.getState().masterVolume, 0.42);
  assert.equal(useAudioStore.getState().presetTrimDb, -4);
  assert.equal(useTempoStore.getState().bpm, 133);
  assert.equal(usePresetStore.getState().activePresetId, activePresetId);
});

const legacyPresetList = () => {
  const factory = usePresetStore.getState().presets.find((preset) => preset.origin === 'factory')!;
  const user = (index: number) => ({ ...factory, id: `user-${index}`, name: `내 프리셋 ${index}`, origin: 'user', category: 'User Presets', updatedAt: '2026-05-01T00:00:00.000Z' });
  const editedFactory = { ...factory, masterVolume: 0.2, updatedAt: '2026-06-01T00:00:00.000Z' };
  return [user(1), user(2), user(3), editedFactory];
};

test('e. 3 user presets and 1 edited factory preset become 4 user presets', () => {
  storage.data.set(LEGACY.presets, JSON.stringify({ version: 3, presets: legacyPresetList() }));
  migrateLegacyStorage();
  const presets = loadUserPresets();
  assert.equal(presets.length, 4);
  assert.equal(presets.filter((preset) => preset.name.endsWith('(이전 사용자 설정)')).length, 1);
  assert.ok(presets.every((preset) => preset.origin === 'user'));
  assert.equal(storage.data.has(LEGACY.presets), false);
  usePresetStore.getState().hydratePresets();
  assert.equal(usePresetStore.getState().presets.length, 108 + 4);
});

test('f. running the migration twice gives the same result', () => {
  storage.data.set(LEGACY.sessionV2, JSON.stringify({ pedals: customPedals(), masterVolume: 0.42, tempoBpm: 133, activePresetId: null }));
  storage.data.set(LEGACY.pedalsV1, JSON.stringify(customPedals()));
  storage.data.set(LEGACY.presets, JSON.stringify(legacyPresetList()));
  migrateLegacyStorage();
  const first = new Map(storage.data);
  const second = migrateLegacyStorage();
  assert.deepEqual(second, { migrated: [], kept: [] });
  assert.deepEqual(new Map(storage.data), first);
  assert.deepEqual([...storage.data.keys()].sort(), [KEYS.session, KEYS.userPresets].sort());
});

test('saved presets never include factory presets', () => {
  usePresetStore.getState().hydratePresets();
  usePresetStore.getState().savePreset('새 프리셋', { pedals: createDefaultPedals(), masterVolume: 0.3, outputTrimDb: 0, tempoBpm: 120 });
  const stored = JSON.parse(storage.data.get(KEYS.userPresets)!);
  assert.equal(stored.presets.length, 1);
  assert.equal(stored.presets[0].origin, 'user');
});
